using System.Text;
using System.Text.Json;

namespace GameFive.Companion;

internal sealed class GameFiveUploader : IDisposable
{
    private static readonly TimeSpan RetryCooldown = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly UploadQueue _queue;
    private readonly CompanionLogger _logger;
    private readonly HttpClient _httpClient;
    // One upload or flush at a time, so a game is never sent twice concurrently.
    private readonly SemaphoreSlim _gate = new(1, 1);
    // Games the server gave a final answer for this session; never re-sent.
    private readonly HashSet<long> _finishedGameIds = [];
    private DateTimeOffset _nextRetryAt = DateTimeOffset.MinValue;

    // Raised after the server accepts an upload, so the inbox is polled right after it.
    public event Action? Uploaded;

    public GameFiveUploader(UploadQueue queue, CompanionLogger logger, HttpMessageHandler? handler = null)
    {
        _queue = queue;
        _logger = logger;
        _httpClient = CompanionConfig.CreateServerClient(handler);
    }

    public async Task FlushAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await FlushCoreAsync(ignoreCooldown: false, cancellationToken);
        }
        catch (IOException ex)
        {
            _logger.Error("Upload queue file could not be read or written; retrying next flush.", ex);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task UploadOrQueueAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        // On disk before anything is sent, so a shutdown or crash mid-send can't lose the game.
        try
        {
            _queue.Enqueue(upload);
        }
        catch (IOException ex)
        {
            _logger.Error($"Could not queue gameId={upload.GameId}; sending without a queue copy.", ex);
            await _gate.WaitAsync(cancellationToken);
            try { await TryUploadAsync(upload, cancellationToken); }
            finally { _gate.Release(); }
            return;
        }

        // The new game is newest, so the flush tries it first; the cooldown doesn't hold back a fresh game.
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await FlushCoreAsync(ignoreCooldown: true, cancellationToken);
        }
        catch (IOException ex)
        {
            _logger.Error("Upload queue file could not be read or written; retrying next flush.", ex);
        }
        finally
        {
            _gate.Release();
        }
    }

    // Retirement's last drain ignores the cooldown.
    public void ResetCooldown()
    {
        _nextRetryAt = DateTimeOffset.MinValue;
    }

    private async Task FlushCoreAsync(bool ignoreCooldown, CancellationToken cancellationToken)
    {
        if (!ignoreCooldown && DateTimeOffset.UtcNow < _nextRetryAt)
        {
            return;
        }

        var queuedUploads = _queue.Load();

        if (queuedUploads.Count == 0)
        {
            return;
        }

        var answered = new List<long>();

        foreach (var upload in queuedUploads.OrderByDescending(upload => upload.GameCreation))
        {
            if (_finishedGameIds.Contains(upload.GameId) || await TryUploadAsync(upload, cancellationToken))
            {
                answered.Add(upload.GameId);
            }
            else
            {
                break; // after the first transient failure keep the rest queued untried until the next flush
            }
        }

        // Removes only what was answered, so a game enqueued meanwhile is never overwritten.
        _queue.Remove(answered);
        _logger.Info($"Upload flush: queued={queuedUploads.Count}, answered={answered.Count}");
    }

    // True when the server gave a final answer (the game leaves the queue); false keeps it queued.
    private async Task<bool> TryUploadAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        try
        {
            var json = JsonSerializer.Serialize(upload, JsonOptions);
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/ingest/match")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var status = (int)response.StatusCode;

            if (!CompanionRules.IsFinalUploadAnswer(status))
            {
                _logger.Info($"Mayhem upload failed; kept for retry. gameId={upload.GameId}, status={status}, body={body}");
                _nextRetryAt = DateTimeOffset.UtcNow.Add(RetryCooldown);
                return false;
            }

            _finishedGameIds.Add(upload.GameId);
            if (!response.IsSuccessStatusCode)
            {
                _logger.Error($"Mayhem upload rejected as invalid; dropped. gameId={upload.GameId}, status={status}, body={body}");
                return true;
            }

            _logger.Info($"Mayhem upload accepted. gameId={upload.GameId}, body={body}");
            Uploaded?.Invoke();
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _nextRetryAt = DateTimeOffset.UtcNow.Add(RetryCooldown);
            _logger.Error($"Mayhem upload failed; kept for retry. gameId={upload.GameId}", ex);
            return false;
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
