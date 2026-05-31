namespace GameFive.Companion;

internal sealed class LcuConnection : IDisposable
{
    public int Port { get; init; }
    public string AuthToken { get; init; } = "";
    public string Protocol { get; init; } = "https";

    public void Dispose()
    {
        // Add cleanup logic if necessary
    }
}
