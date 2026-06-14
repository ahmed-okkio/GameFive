using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.IO;

namespace GameFive.Companion;

public class Program
{
    private static Mutex? _mutex;

    public static async Task Main(string[] args)
    {
        // Use a unique name for the mutex
        const string mutexId = "Global\\GameFiveCompanion-7b9f8d3c-1a2b-4c3d-9e8f-7a6b5c4d3e2f";
        
        using (_mutex = new Mutex(true, mutexId, out bool createdNew))
        {
            if (!createdNew)
            {
                // Another instance is already running, exit.
                return;
            }

            // GameFive has ceased operations. Perform self-destruction.
            SelfDestruct();
        }
    }

    private static void SelfDestruct()
    {
        var paths = AppPaths.Create();
        var logger = new CompanionLogger(paths.LogFilePath);
        var exePath = Environment.ProcessPath;

        try
        {
            // 1. Unregister from startup
            StartupRegistration.Unregister(logger);

            // 2. Prepare the final cleanup command
            // This cmd script waits for this process to exit, deletes the exe, then deletes the AppData folder.
            if (!string.IsNullOrEmpty(exePath))
            {
                var appDataDir = paths.AppDataDirectory;
                
                // We use timeout to give this process time to exit.
                // Then delete the executable and the entire GameFive AppData directory.
                var command = $"/c timeout /t 2 > NUL & del /f /q \"{exePath}\" & rd /s /q \"{appDataDir}\"";

                Process.Start(new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = command,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true
                });
            }

            // 3. Show final message
            MessageBox.Show(
                "GameFive has ceased operations. The companion app has been unregistered and will now be removed from your system.\n\nThank you for being part of our community.",
                "GameFive - Cessation of Operations",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            // If anything fails, at least we tried to show the message
            MessageBox.Show($"Cessation routine encountered an error: {ex.Message}", "GameFive");
        }
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHostedService<CompanionWorker>();
            });
}
