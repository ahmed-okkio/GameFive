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
    // Games the queue file could not take; held in memory and retried every flush, so none drops while we run.
    private readonly List<CompanionMatchUpload> _pending = [];
    private DateTimeOffset _nextRetryAt = DateTimeOffset.MinValue;

    // Raised after the server accepts an upload, so the inbox is polled right after it.
    public event Action? Uploaded;

    public GameFiveUploader(UploadQueue queue, CompanionLogger logger, HttpMessageHandler? handler = null)
    {
        _queue = queue;
        _logger = logger;
        _httpClient = CompanionConfig.CreateServerClient(handler);
    }

    public Task FlushAsync(CancellationToken cancellationToken) => FlushGatedAsync(ignoreCooldown: false, cancellationToken);

    public async Task UploadOrQueueAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        // On disk before anything is sent, so a shutdown or crash mid-send can't lose the game.
        try
        {
            _queue.Enqueue(upload);
        }
        catch (Exception ex) when (UploadQueue.IsFileError(ex))
        {
            _logger.Error($"Could not queue gameId={upload.GameId}; holding it in memory until the queue file is writable.", ex);
            lock (_pending) _pending.Add(upload);
        }

        // The new game is newest, so the flush tries it first; the cooldown doesn't hold back a fresh game.
        await FlushGatedAsync(ignoreCooldown: true, cancellationToken);
    }

    // Retirement's last drain ignores the cooldown.
    public void ResetCooldown()
    {
        _nextRetryAt = DateTimeOffset.MinValue;
    }

    private async Task FlushGatedAsync(bool ignoreCooldown, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await FlushCoreAsync(ignoreCooldown, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Never let a flush take down the worker loop; the next flush retries.
            _logger.Error("Upload flush failed; retrying next flush.", ex);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task FlushCoreAsync(bool ignoreCooldown, CancellationToken cancellationToken)
    {
        if (!ignoreCooldown && DateTimeOffset.UtcNow < _nextRetryAt)
        {
            return;
        }

        // Move in-memory games onto disk where possible; any left stay pending and are still sent below.
        foreach (var upload in Pending())
        {
            try
            {
                _queue.Enqueue(upload);
                lock (_pending) _pending.Remove(upload);
            }
            catch (Exception ex) when (UploadQueue.IsFileError(ex))
            {
                break;
            }
        }

        List<CompanionMatchUpload> queuedUploads;
        try
        {
            queuedUploads = _queue.Load();
        }
        catch (Exception ex) when (UploadQueue.IsFileError(ex))
        {
            _logger.Error("Upload queue file unreadable for now; sending in-memory games only.", ex);
            queuedUploads = [];
        }

        var candidates = queuedUploads.Concat(Pending())
            .GroupBy(upload => upload.GameId)
            .Select(group => group.First())
            .OrderByDescending(upload => upload.GameCreation)
            .ToList();
        if (candidates.Count == 0)
        {
            return;
        }

        var answered = new List<long>();

        foreach (var upload in candidates)
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

        lock (_pending) _pending.RemoveAll(upload => answered.Contains(upload.GameId));
        try
        {
            // Removes only what was answered, so a game enqueued meanwhile is never overwritten.
            _queue.Remove(answered);
        }
        catch (Exception ex) when (UploadQueue.IsFileError(ex))
        {
            // Answered ids are in _finishedGameIds, so a later flush drops them from the file unsent.
            _logger.Error("Could not remove answered games from the queue file; a later flush will.", ex);
        }
        _logger.Info($"Upload flush: candidates={candidates.Count}, answered={answered.Count}");
    }

    private List<CompanionMatchUpload> Pending()
    {
        lock (_pending) return [.. _pending];
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
