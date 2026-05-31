namespace GameFive.Companion;

internal sealed class CompanionLogger
{
    private readonly string _path;
    private readonly object _lock = new();

    public CompanionLogger(string path)
    {
        _path = path;
        // Clear the log file on startup
        File.WriteAllText(_path, string.Empty);
    }

    public void Info(string message) => Write("INFO", message);
    public void Warn(string message) => Write("WARN", message);
    public void Error(string message, Exception? ex = null) => Write("ERROR", $"{message} {(ex != null ? ex.ToString() : "")}");

    private void Write(string level, string message)
    {
        var line = $"{DateTimeOffset.Now:O} [{level}] {message}";
        lock (_lock)
        {
            try {
                File.AppendAllText(_path, line + Environment.NewLine);
            } catch {
                // Ignore logging failures
            }
        }
    }
}
