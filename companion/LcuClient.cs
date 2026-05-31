using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace GameFive.Companion;

internal sealed class LcuClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly CompanionLogger _logger;

    public LcuClient(LcuConnection connection, CompanionLogger logger)
    {
        _logger = logger;
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };

        _httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri($"{connection.Protocol}://127.0.0.1:{connection.Port}")
        };

        var authBytes = Encoding.ASCII.GetBytes($"riot:{connection.AuthToken}");
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
    }

    public async Task<string?> GetCurrentPuuidAsync(CancellationToken cancellationToken)
    {
        var summoner = await GetJsonAsync<LcuSummoner>("/lol-summoner/v1/current-summoner", cancellationToken);
        return summoner?.Puuid;
    }

    public async Task<LcuGame?> GetMostRecentMatchAsync(string puuid, CancellationToken cancellationToken)
    {
        var matches = await GetRecentMatchesAsync(puuid, 1, cancellationToken);

        return matches.FirstOrDefault();
    }

    public async Task<List<LcuGame>> GetRecentMatchesAsync(string puuid, int count, CancellationToken cancellationToken)
    {
        var response = await GetJsonAsync<LcuMatchHistoryResponse>(
            $"/lol-match-history/v1/products/lol/{Uri.EscapeDataString(puuid)}/matches?begIndex=0&endIndex={count}",
            cancellationToken);

        return response?.Games.Items ?? [];
    }

    public async Task<LcuGame?> TryGetMatchDetailsAsync(long gameId, CancellationToken cancellationToken)
    {
        var candidatePaths = new[]
        {
            $"/lol-match-history/v1/games/{gameId}",
            $"/lol-match-history/v1/game/{gameId}"
        };

        foreach (var path in candidatePaths)
        {
            try
            {
                return await GetJsonAsync<LcuGame>(path, cancellationToken);
            }
            catch (HttpRequestException)
            {
            }
        }

        return null;
    }

    private async Task<T?> GetJsonAsync<T>(string path, CancellationToken cancellationToken)
    {
        var fullUrl = new Uri(_httpClient.BaseAddress!, path);
        try
        {
            using var response = await _httpClient.GetAsync(path, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.Error($"LCU API Error: {response.StatusCode} for {fullUrl}. Content: {content}");
                response.EnsureSuccessStatusCode();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.Error($"HTTP Request failed for {fullUrl}", ex);
            throw;
        }
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
