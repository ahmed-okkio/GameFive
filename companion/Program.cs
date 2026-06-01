using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace GameFive.Companion;

public class Program
{
    public static async Task Main(string[] args)
    {
        if (args.Contains("--debug-match"))
        {
            var appPaths = AppPaths.Create();
            var logger = new CompanionLogger(appPaths.LogFilePath);
            var config = new ConfigStore(appPaths.ConfigFilePath, logger).Load();
            
            if (config != null)
            {
                var lockfile = LcuLockfile.TryRead(logger);
                if (lockfile != null)
                {
                    await DebugMatch.Run(logger, lockfile);
                }
            }
            return;
        }
        CreateHostBuilder(args).Build().Run();
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHostedService<CompanionWorker>();
            });
}
