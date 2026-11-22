using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace GameFive.Companion;

// Client for the /api/companion/* endpoints (PRD §4).
internal sealed class CompanionApi
{
    private readonly HttpClient _http;
    private readonly CompanionLogger _logger;

    public CompanionApi(CompanionLogger logger)
    {
        _logger = logger;
        _http = CompanionConfig.CreateServerClient();
    }

    // True on a 2xx answer.
    public async Task<bool> RegisterAsync(LcuSummoner summoner, CancellationToken ct)
    {
        try
        {
            using var response = await _http.PostAsJsonAsync("api/companion/register", new
            {
                puuid = summoner.Puuid,
                gameName = summoner.GameName,
                tagLine = summoner.TagLine,
                version = CompanionConfig.Version
            }, ct);
            _logger.Info($"Register: status={(int)response.StatusCode}");
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.Error("Register failed.", ex);
            return false;
        }
    }

    public async Task<string?> LoginLinkAsync(string puuid, string redirect, CancellationToken ct)
    {
        try
        {
            using var response = await _http.PostAsJsonAsync("api/companion/login-link", new { puuid, redirect }, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.Warn($"Login link failed: status={(int)response.StatusCode}");
                return null;
            }
            return (await response.Content.ReadFromJsonAsync<LoginLinkResponse>(ct))?.Url;
        }
        catch (Exception ex)
        {
            _logger.Error("Login link failed.", ex);
            return null;
        }
    }

    public async Task<InboxResponse?> InboxAsync(string puuid, string since, bool briefing, CancellationToken ct)
    {
        try
        {
            var query = $"api/companion/inbox?puuid={Uri.EscapeDataString(puuid)}&since={Uri.EscapeDataString(since)}&briefing={(briefing ? 1 : 0)}";
            return await _http.GetFromJsonAsync<InboxResponse>(query, ct);
        }
        catch (Exception ex)
        {
            _logger.Error("Inbox poll failed.", ex);
            return null;
        }
    }

    public async Task<CompanionStatus?> StatusAsync(CancellationToken ct)
    {
        try
        {
            // A server that accepts but never answers must not hold startup for HttpClient's 100 s default.
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            return await _http.GetFromJsonAsync<CompanionStatus>("api/companion/status", timeout.Token);
        }
        catch (Exception ex)
        {
            _logger.Error("Status check failed.", ex);
            return null;
        }
    }

    // Opens a site page as the Entrant through a fresh login link; falls back to the plain URL unless
    // requireLoginLink. True when a login link was obtained and opened.
    public async Task<bool> OpenAsEntrantAsync(string? puuid, string redirect, bool requireLoginLink = false)
    {
        var url = puuid is null ? null : await LoginLinkAsync(puuid, redirect, CancellationToken.None);
        if (url is null && requireLoginLink) return false;
        Process.Start(new ProcessStartInfo(url ?? new Uri(_http.BaseAddress!, redirect).ToString()) { UseShellExecute = true });
        return url is not null;
    }

    private sealed class LoginLinkResponse
    {
        [JsonPropertyName("url")]
        public string? Url { get; set; }
    }
}

internal sealed class InboxResponse
{
    [JsonPropertyName("items")]
    public List<InboxItem> Items { get; set; } = [];

    // JsonElement so a string or numeric timestamp both round-trip into the next `since`.
    [JsonPropertyName("now")]
    public System.Text.Json.JsonElement Now { get; set; }
}

internal sealed class InboxItem
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("body")]
    public string? Body { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }
}
