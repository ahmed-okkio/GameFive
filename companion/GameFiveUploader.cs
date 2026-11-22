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
            await FlushCoreAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task UploadOrQueueAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_finishedGameIds.Contains(upload.GameId))
            {
                _logger.Info($"Mayhem upload skipped; already answered this session. gameId={upload.GameId}");
                return;
            }

            // Try to upload the current match AND flush the queue
            await FlushCoreAsync(cancellationToken);

            if (await TryUploadAsync(upload, cancellationToken))
            {
                return;
            }

            _queue.Enqueue(upload);
            _logger.Info($"Upload failed. Queued Mayhem upload for retry. gameId={upload.GameId}");
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

    private async Task FlushCoreAsync(CancellationToken cancellationToken)
    {
        if (DateTimeOffset.UtcNow < _nextRetryAt)
        {
            return;
        }

        var queuedUploads = _queue.Load();

        if (queuedUploads.Count == 0)
        {
            return;
        }

        var remaining = new List<CompanionMatchUpload>();

        foreach (var upload in queuedUploads)
        {
            // After the first transient failure keep the rest queued untried until the cooldown ends.
            var keep = !_finishedGameIds.Contains(upload.GameId)
                && (remaining.Count > 0 || !await TryUploadAsync(upload, cancellationToken));
            if (keep)
            {
                remaining.Add(upload);
            }
        }

        _queue.Save(remaining);
        _logger.Info($"Upload retry summary: queued={queuedUploads.Count}, remaining={remaining.Count}");
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
