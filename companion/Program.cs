using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System.Threading;

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

            CreateHostBuilder(args).Build().Run();
        }
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHostedService<CompanionWorker>();
            });
}
