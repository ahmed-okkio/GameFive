namespace GameFive.Companion;

internal sealed class AppPaths
{
    private AppPaths(string appDataDirectory)
    {
        AppDataDirectory = appDataDirectory;
        ConfigFilePath = Path.Combine(appDataDirectory, "config.json");
        LogFilePath = Path.Combine(appDataDirectory, "companion.log");
        FailedUploadsPath = Path.Combine(appDataDirectory, "failed-uploads.json");
        BriefingDayPath = Path.Combine(appDataDirectory, "briefing-day.txt");
    }

    public string AppDataDirectory { get; }
    public string ConfigFilePath { get; }
    public string LogFilePath { get; }
    public string FailedUploadsPath { get; }
    public string BriefingDayPath { get; }

    public static AppPaths Create()
    {
        // Same folder as the installed exe, so retirement removes everything in one go.
        var directory = CompanionRules.InstallDirectory(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
        Directory.CreateDirectory(directory);
        return new AppPaths(directory);
    }
}
