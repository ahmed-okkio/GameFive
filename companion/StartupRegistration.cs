using Microsoft.Win32;

namespace GameFive.Companion;

internal static class StartupRegistration
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "GameFiveCompanion";

    public static void EnsureRegistered(CompanionLogger logger)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            if (key is null)
            {
                logger.Info("Startup registry key was not found.");
                return;
            }

            var executablePath = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(executablePath))
            {
                logger.Info("Could not determine executable path for startup registration.");
                return;
            }

            key.SetValue(ValueName, $"\"{executablePath}\"");
            logger.Info("Startup registration ensured.");
        }
        catch (Exception ex)
        {
            logger.Error("Failed to register startup entry.", ex);
        }
    }
}
