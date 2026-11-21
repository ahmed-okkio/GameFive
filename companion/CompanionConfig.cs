using System.Net.Http.Headers;

namespace GameFive.Companion;

public static class CompanionConfig
{
    public const string AuthToken = "game-five-383";
    public const string ServerBaseUrl = "https://game-five-kohl.vercel.app/";
    public const int DiagnosticMatchLimit = 10;

    public static readonly string Version =
        System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";

    // Every request to the server carries the shared token and X-Companion-Version.
    public static HttpClient CreateServerClient(HttpMessageHandler? handler = null)
    {
        var client = handler != null ? new HttpClient(handler) : new HttpClient();
        client.BaseAddress = new Uri(ServerBaseUrl);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthToken);
        client.DefaultRequestHeaders.Add("X-Companion-Version", Version);
        return client;
    }
}
