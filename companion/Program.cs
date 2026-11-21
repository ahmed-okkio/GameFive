using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics;
using System.Threading;

namespace GameFive.Companion;

public class Program
{
    private static Mutex? _mutex;

    public static async Task Main(string[] args)
    {
#if !DEBUG
        if (TryInstallAndRelaunch()) return;
#endif

        // Use a unique name for the mutex
        const string mutexId = "Global\\GameFiveCompanion-7b9f8d3c-1a2b-4c3d-9e8f-7a6b5c4d3e2f";
        
        using (_mutex = new Mutex(true, mutexId, out bool createdNew))
        {
            if (!createdNew)
            {
                // Another instance is already running, exit.
                return;
            }

            CreateHostBuilder(args).Build().Run();
        }
    }

    // First run from anywhere else (e.g. Downloads): copy to %LocalAppData%\GameFive, autostart that copy, relaunch it.
    private static bool TryInstallAndRelaunch()
    {
        var current = Environment.ProcessPath;
        if (current is null) return false;
        var target = CompanionRules.InstallTarget(current, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData));
        if (target is null) return false;

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(current, target, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Usually the installed copy is running and locked; fall through and let the mutex decide.
            return false;
        }

        StartupRegistration.EnsureRegistered(null, target);
        Process.Start(new ProcessStartInfo(target) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(target)! });
        return true;
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHostedService<CompanionWorker>();
            });
}
