using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace GameFive.Companion;

internal sealed class LcuService : IDisposable
{
    private readonly LcuConnection _connection;
    private readonly CompanionLogger _logger;
    private readonly GameFiveUploader _uploader;
    private readonly Action<bool> _onConnectionChanged;
    private ClientWebSocket? _webSocket;
    private readonly CancellationTokenSource _cts = new();

    public LcuService(LcuConnection connection, CompanionLogger logger, GameFiveUploader uploader, Action<bool> onConnectionChanged)
    {
        _connection = connection;
        _logger = logger;
        _uploader = uploader;
        _onConnectionChanged = onConnectionChanged;
    }

    public void Connect()
    {
        _ = Task.Run(() => ConnectAsync(_cts.Token));
    }

    private async Task ConnectAsync(CancellationToken ct)
    {
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

            await ListenAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.Error("LCU WebSocket connection failed.", ex);
            _onConnectionChanged(false); // Signal disconnected
        }
    }

    private async Task ListenAsync(CancellationToken ct)
    {
        var buffer = new byte[1024 * 64]; // Increased buffer size for JSON payloads
        while (_webSocket?.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", ct);
            }
            else
            {
                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                // Check for the end-of-game stats block event
                if (message.Contains("eog-stats-block"))
                {
                    _logger.Info("End-of-game event received. Ingesting match...");
                    await IngestLatestMatchAsync(ct);
                }
            }
        }
    }

    private async Task IngestLatestMatchAsync(CancellationToken ct)
    {
        try
        {
            using var client = new LcuClient(_connection, _logger);
            var puuid = await client.GetCurrentPuuidAsync(ct);
            if (string.IsNullOrWhiteSpace(puuid)) return;

            var match = await client.GetMostRecentMatchAsync(puuid, ct);
            if (match == null || !MatchMapper.IsLikelyMayhem(match)) return;

            var detailedMatch = await client.TryGetMatchDetailsAsync(match.GameId, ct);
            if (detailedMatch == null) return;

            var upload = MatchMapper.ToUpload(detailedMatch, puuid);
            await _uploader.UploadOrQueueAsync(upload, ct);
            _logger.Info($"Mayhem match {match.GameId} ingested successfully.");
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to ingest latest match.", ex);
        }
    }

    public void Dispose()
    {
        _cts.Cancel();
        _webSocket?.Dispose();
    }
}
