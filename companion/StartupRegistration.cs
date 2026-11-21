using Microsoft.Win32;

namespace GameFive.Companion;

internal static class StartupRegistration
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "GameFiveCompanion";

    public static void EnsureRegistered(CompanionLogger? logger, string executablePath)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            if (key is null)
            {
                logger?.Info("Startup registry key was not found.");
                return;
            }

            key.SetValue(ValueName, $"\"{executablePath}\"");
            logger?.Info($"Startup registration ensured: {executablePath}");
        }
        catch (Exception ex)
        {
            logger?.Error("Failed to register startup entry.", ex);
        }
    }

    public static void Unregister(CompanionLogger logger)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, writable: true);
            key?.DeleteValue(ValueName, false);
            logger.Info("Startup registration removed.");
        }
        catch (Exception ex)
        {
            logger.Error("Failed to remove startup entry.", ex);
        }
    }
}
