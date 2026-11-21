using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace GameFive.Companion;

internal sealed class LcuService : IDisposable
{
    private static readonly TimeSpan InboxInterval = TimeSpan.FromSeconds(60);

    private readonly LcuConnection _connection;
    private readonly CompanionLogger _logger;
    private readonly GameFiveUploader _uploader;
    private readonly CompanionApi _api;
    private readonly AppPaths _paths;
    private readonly Action<string, string, Action> _showToast;
    private readonly Action<bool> _onConnectionChanged;
    private readonly SemaphoreSlim _inboxLock = new(1, 1);
    private ClientWebSocket? _webSocket;
    private readonly CancellationTokenSource _cts = new();
    private string _inboxSince = DateTimeOffset.UtcNow.ToString("O");
    private long _lastIngestedGameId;

    public LcuService(LcuConnection connection, CompanionLogger logger, GameFiveUploader uploader, CompanionApi api,
        AppPaths paths, Action<string, string, Action> showToast, Action<bool> onConnectionChanged)
    {
        _connection = connection;
        _logger = logger;
        _uploader = uploader;
        _api = api;
        _paths = paths;
        _showToast = showToast;
        _onConnectionChanged = onConnectionChanged;
    }

    // The connected Entrant. Null until the summoner is read; never cached beyond this connection.
    public string? Puuid { get; private set; }

    public async Task<bool> ConnectAsync()
    {
        var ct = _cts.Token;
        _webSocket = new ClientWebSocket();
        // Disable SSL validation for LCU self-signed cert
        _webSocket.Options.RemoteCertificateValidationCallback = (_, _, _, _) => true;

        var authHeader = Convert.ToBase64String(Encoding.UTF8.GetBytes($"riot:{_connection.AuthToken}"));
        _webSocket.Options.SetRequestHeader("Authorization", $"Basic {authHeader}");

        try
        {
            await _webSocket.ConnectAsync(new Uri($"wss://127.0.0.1:{_connection.Port}"), ct);
            _logger.Info("LCU WebSocket connected.");
            _onConnectionChanged(true); // Signal connected!

            // Subscribe to end-of-game event
            var subscribeMessage = JsonSerializer.Serialize(new object[] { 5, "OnJsonApiEvent_lol-end-of-game_v1_eog-stats-block" });
            await _webSocket.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(subscribeMessage)), WebSocketMessageType.Text, true, ct);

            _ = Task.Run(() => StartEntrantSessionAsync(ct));
            await ListenAsync(ct);
            return true;
        }
        catch (Exception) when (ct.IsCancellationRequested)
        {
            return true; // Disposed because the client closed; not a failed connect.
        }
        catch (Exception ex)
        {
            _logger.Error("LCU WebSocket connection failed.", ex);
            _onConnectionChanged(false); // Signal disconnected
            return false;
        }
    }

    public async Task<string?> GetGameflowPhaseAsync()
    {
        using var client = new LcuClient(_connection, _logger);
        return await client.GetGameflowPhaseAsync(_cts.Token);
    }

    // Register on every connect, then poll the inbox every 60 s while connected.
    private async Task StartEntrantSessionAsync(CancellationToken ct)
    {
        try
        {
            LcuSummoner? summoner = null;
            for (var i = 0; i < 6 && summoner is null; i++)
            {
                if (i > 0) await Task.Delay(TimeSpan.FromSeconds(10), ct); // client may still be logging in
                try
                {
                    using var client = new LcuClient(_connection, _logger);
                    summoner = await client.GetCurrentSummonerAsync(ct);
                }
                catch (HttpRequestException)
                {
                }
                if (string.IsNullOrWhiteSpace(summoner?.Puuid)) summoner = null;
            }
            if (summoner is null)
            {
                _logger.Warn("Could not read the current summoner; not registering.");
                return;
            }

            await _api.RegisterAsync(summoner, ct);
            Puuid = summoner.Puuid;

            using var timer = new PeriodicTimer(InboxInterval);
            var briefing = CompanionRules.NeedsBriefing(ReadBriefingDay(), DateTimeOffset.UtcNow);
            do
            {
                if (await PollInboxAsync(briefing) && briefing)
                {
                    briefing = false;
                    File.WriteAllText(_paths.BriefingDayPath, CompanionRules.GmtDay(DateTimeOffset.UtcNow));
                }
            } while (await timer.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            _logger.Error("Entrant session failed.", ex);
        }
    }

    private string? ReadBriefingDay()
    {
        try { return File.Exists(_paths.BriefingDayPath) ? File.ReadAllText(_paths.BriefingDayPath).Trim() : null; }
        catch (IOException) { return null; }
    }

    // Shows at most one item; the rest of the batch is dropped, as is anything missed while closed.
    public async Task<bool> PollInboxAsync(bool briefing = false)
    {
        var puuid = Puuid;
        if (puuid is null || _cts.IsCancellationRequested || !await _inboxLock.WaitAsync(0)) return false;
        try
        {
            var inbox = await _api.InboxAsync(puuid, _inboxSince, briefing, _cts.Token);
            if (inbox is null) return false;
            if (inbox.Now.ValueKind is not (JsonValueKind.Undefined or JsonValueKind.Null))
            {
                _inboxSince = inbox.Now.ToString();
            }

            var item = inbox.Items.FirstOrDefault();
            if (item != null)
            {
                var url = item.Url ?? "/";
                _showToast(item.Title ?? "GameFive", item.Body ?? "", () => _ = _api.OpenAsEntrantAsync(Puuid, url));
            }
            return true;
        }
        finally
        {
            _inboxLock.Release();
        }
    }

    private async Task ListenAsync(CancellationToken ct)
    {
        var buffer = new byte[1024 * 64];
        using var message = new MemoryStream();
        while (_webSocket?.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", ct);
                continue;
            }

            // The eog block is larger than one frame; collect the whole message before parsing.
            message.Write(buffer, 0, result.Count);
            if (!result.EndOfMessage) continue;

            var text = Encoding.UTF8.GetString(message.GetBuffer(), 0, (int)message.Length);
            message.SetLength(0);
            if (text.Contains("eog-stats-block"))
            {
                await HandleEndOfGameAsync(text, ct);
            }
        }
    }

    private async Task HandleEndOfGameAsync(string message, CancellationToken ct)
    {
        try
        {
            // Event frame: [8, "OnJsonApiEvent_...", {data, eventType, uri}]
            using var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() < 3) return;
            if (!root[2].TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return;
            if (!data.TryGetProperty("gameId", out var gameIdElement) || !gameIdElement.TryGetInt64(out var gameId)) return;
            if (gameId == _lastIngestedGameId) return; // the event fires more than once per game

            JsonElement? stats = data.TryGetProperty("localPlayer", out var localPlayer)
                && localPlayer.TryGetProperty("stats", out var statsElement)
                ? statsElement.Clone()
                : null;

            _lastIngestedGameId = gameId;
            _logger.Info($"End-of-game event received for game {gameId}. Ingesting match...");
            await IngestMatchAsync(gameId, stats, ct);
        }
        catch (JsonException ex)
        {
            _logger.Error("Could not parse end-of-game event.", ex);
        }
    }

    private async Task IngestMatchAsync(long gameId, JsonElement? endOfGameStats, CancellationToken ct)
    {
        try
        {
            using var client = new LcuClient(_connection, _logger);
            var puuid = await client.GetCurrentPuuidAsync(ct);
            if (string.IsNullOrWhiteSpace(puuid)) return;

            // Match history can lag the end-of-game screen by a few seconds.
            LcuGame? match = null;
            for (var i = 0; i < 6 && match is null; i++)
            {
                if (i > 0) await Task.Delay(TimeSpan.FromSeconds(10), ct);
                match = await client.TryGetMatchDetailsAsync(gameId, ct);
            }
            if (match == null)
            {
                _logger.Warn($"Match {gameId} not found in match history.");
                return;
            }
            if (!MatchMapper.IsMayhem(match))
            {
                _logger.Info($"Game {gameId} is not a Mayhem matched game (queue={match.QueueId}, type={match.GameType}); skipped.");
                return;
            }

            var upload = MatchMapper.ToUpload(match, puuid, endOfGameStats);
            await _uploader.UploadOrQueueAsync(upload, ct);
            _logger.Info($"Mayhem match {gameId} ingested.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.Error("Failed to ingest latest match.", ex);
        }
    }

    public void Dispose()
    {
        Puuid = null;
        _cts.Cancel();
        _webSocket?.Dispose();
    }
}
