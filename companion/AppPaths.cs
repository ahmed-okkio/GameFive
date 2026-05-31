namespace GameFive.Companion;

internal sealed class AppPaths
{
    private AppPaths(string appDataDirectory)
    {
        AppDataDirectory = appDataDirectory;
        ConfigFilePath = Path.Combine(appDataDirectory, "config.json");
        LogFilePath = Path.Combine(appDataDirectory, "companion.log");
        FailedUploadsPath = Path.Combine(appDataDirectory, "failed-uploads.json");
    }

    public string AppDataDirectory { get; }
    public string ConfigFilePath { get; }
    public string LogFilePath { get; }
    public string FailedUploadsPath { get; }

    public static AppPaths Create()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var directory = Path.Combine(appData, "GameFive");
        Directory.CreateDirectory(directory);
        return new AppPaths(directory);
    }
}
