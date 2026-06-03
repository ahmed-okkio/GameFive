using Microsoft.Extensions.Hosting;

namespace GameFive.Companion;

public class CompanionWorker : BackgroundService
{
    private readonly CompanionLogger _logger;
    private readonly AppPaths _appPaths;
    private readonly ConfigStore _configStore;

    public CompanionWorker()
    {
        _appPaths = AppPaths.Create();
        _logger = new CompanionLogger(_appPaths.LogFilePath);
        _configStore = new ConfigStore(_appPaths.ConfigFilePath, _logger);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.Info("GameFive companion starting.");

        var config = _configStore.Load();
        if (config is null)
        {
            _configStore.CreateTemplate();
            _logger.Info("Config created. Please fill it in and restart.");
            return;
        }

        StartupRegistration.EnsureRegistered(_logger);

        var updateManager = new UpdateManager(config, _logger);
        _ = updateManager.CheckForUpdatesAsync(stoppingToken);

        // Start WMI Monitor
        var uploader = new GameFiveUploader(config, new UploadQueue(_appPaths.FailedUploadsPath, _logger), _logger);
        using var monitor = new LcuMonitor(config, _logger, uploader);
        
        // Start Tray Icon thread
        var trayIcon = new TrayIcon(_logger, monitor, updateManager);
        var trayThread = new Thread(() =>
        {
            trayIcon.Run();
        });
        trayThread.SetApartmentState(ApartmentState.STA);
        trayThread.Start();
        
        // Flush queue on startup to handle failed uploads from previous sessions
        await uploader.FlushAsync(stoppingToken);

        try
        {
            _logger.Info("Initializing LCU Monitor...");
            
            // Hook up status change to tray icon
            monitor.StatusChanged += (s, status) => {
                trayIcon.SetConnected(status == LcuStatus.Connected);
            };

            _logger.Info("Starting LCU Monitor...");
            monitor.Start();
            
            // Keep running until stopped
            int counter = 0;
            int updateCounter = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
                
                // Flush every 5 minutes (300 seconds)
                if (++counter >= 300)
                {
                    counter = 0;
                    await uploader.FlushAsync(stoppingToken);
                }

                // Check for updates every 12 hours (43200 seconds)
                if (++updateCounter >= 43200)
                {
                    updateCounter = 0;
                    _ = updateManager.CheckForUpdatesAsync(stoppingToken);
                }
            }
            monitor.Stop();
        }
        catch (Exception ex)
        {
            _logger.Error("Fatal error during LCU Monitor startup. Ensure you are running as Administrator.", ex);
            throw;
        }
        finally {
            trayIcon.Dispose();
        }
    }
}
