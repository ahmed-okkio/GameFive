using System.Net.Http.Headers;
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

    private readonly CompanionConfig _config;
    private readonly UploadQueue _queue;
    private readonly CompanionLogger _logger;
    private readonly HttpClient _httpClient;
    private readonly HashSet<long> _attemptedGameIds = [];
    private DateTimeOffset _nextRetryAt = DateTimeOffset.MinValue;
    private bool _uploadsDisabled;

    public GameFiveUploader(CompanionConfig config, UploadQueue queue, CompanionLogger logger, HttpMessageHandler? handler = null)
    {
        _config = config;
        _queue = queue;
        _logger = logger;
        _httpClient = handler != null ? new HttpClient(handler) : new HttpClient();
    }

    public async Task FlushAsync(CancellationToken cancellationToken)
    {
        if (_uploadsDisabled || DateTimeOffset.UtcNow < _nextRetryAt)
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
            if (_attemptedGameIds.Contains(upload.GameId))
            {
                continue;
            }

            if (!await TryUploadAsync(upload, cancellationToken))
            {
                remaining.Add(upload);
            }
        }

        _queue.Save(remaining);
        _logger.Info($"Upload retry summary: attempted={queuedUploads.Count}, remaining={remaining.Count}");
    }

    public async Task UploadOrQueueAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        if (_uploadsDisabled)
        {
            _logger.Info($"Mayhem upload skipped; uploads disabled after auth failure. gameId={upload.GameId}");
            return;
        }

        if (_attemptedGameIds.Contains(upload.GameId))
        {
            _logger.Info($"Mayhem upload skipped; already attempted this session. gameId={upload.GameId}");
            return;
        }

        // Retry logic with exponential backoff (starting at 2s, doubling up to 60s)
        int maxRetries = 30;
        int delayMs = 2000; 
        int maxDelayMs = 60000;

        for (int i = 0; i <= maxRetries; i++)
        {
            if (await TryUploadAsync(upload, cancellationToken))
            {
                return; // Success!
            }

            if (i < maxRetries)
            {
                _logger.Warn($"Retry {i + 1}/{maxRetries} for match {upload.GameId} in {delayMs}ms.");
                await Task.Delay(delayMs, cancellationToken);
                delayMs = Math.Min(delayMs * 2, maxDelayMs); // Exponential backoff capped at 60s
            }
        }

        _queue.Enqueue(upload);
        _logger.Info($"All retry attempts failed. Queued Mayhem upload for retry. gameId={upload.GameId}");
    }

    public void ClearUploadedGameIds()
    {
        _attemptedGameIds.Clear();
        _uploadsDisabled = false;
        _nextRetryAt = DateTimeOffset.MinValue;
    }

    private async Task<bool> TryUploadAsync(CompanionMatchUpload upload, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_config.ServerBaseUrl) || string.IsNullOrWhiteSpace(_config.AuthToken))
        {
            _logger.Info("Upload skipped because ServerBaseUrl/AuthToken is missing.");
            return false;
        }

        try
        {
            var url = new Uri(new Uri(_config.ServerBaseUrl.TrimEnd('/') + "/"), "api/ingest/match");
            var json = JsonSerializer.Serialize(upload, JsonOptions);
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.AuthToken);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _attemptedGameIds.Add(upload.GameId);

            if (!response.IsSuccessStatusCode)
            {
                _logger.Info($"Mayhem upload failed. gameId={upload.GameId}, status={(int)response.StatusCode}, body={body}");
                _nextRetryAt = DateTimeOffset.UtcNow.Add(RetryCooldown);

                if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                {
                    _uploadsDisabled = true;
                    _logger.Info("Mayhem uploads disabled for this League session because auth failed. Fix config and restart companion.");
                }

                return false;
            }

            _logger.Info($"Mayhem upload accepted. gameId={upload.GameId}, body={body}");
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _attemptedGameIds.Add(upload.GameId);
            _nextRetryAt = DateTimeOffset.UtcNow.Add(RetryCooldown);
            _logger.Error($"Mayhem upload failed. gameId={upload.GameId}", ex);
            return false;
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
