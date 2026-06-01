using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace GameFive.Companion;

public class Program
{
    public static async Task Main(string[] args)
    {
        CreateHostBuilder(args).Build().Run();
    }

    public static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureServices((hostContext, services) =>
            {
                services.AddHostedService<CompanionWorker>();
            });
}
