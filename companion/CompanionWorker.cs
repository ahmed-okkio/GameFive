using System.Diagnostics;
using Microsoft.Extensions.Hosting;

namespace GameFive.Companion;

public class CompanionWorker : BackgroundService
{
    // Status (retirement) and update checks share one timer.
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    private readonly CompanionLogger _logger;
    private readonly AppPaths _appPaths;

    public CompanionWorker()
    {
        _appPaths = AppPaths.Create();
        _logger = new CompanionLogger(_appPaths.LogFilePath);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.Info($"GameFive companion {CompanionConfig.Version} starting.");

        var exePath = Environment.ProcessPath;
        if (exePath != null && CompanionRules.InstallTarget(exePath, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)) == null)
        {
            StartupRegistration.EnsureRegistered(_logger, exePath);
        }

        var api = new CompanionApi(_logger);
        var uploader = new GameFiveUploader(new UploadQueue(_appPaths.FailedUploadsPath, _logger), _logger);
        TrayIcon? trayIcon = null;
        using var monitor = new LcuMonitor(_logger, uploader, api, _appPaths, (title, body, onClick) => trayIcon?.ShowToast(title, body, onClick));
        var updateManager = new UpdateManager(_logger, monitor.GetGameflowPhaseAsync);

        // Start Tray Icon thread
        trayIcon = new TrayIcon(_logger, monitor, updateManager, api);
        var trayThread = new Thread(() =>
        {
            trayIcon.Run();
        });
        trayThread.SetApartmentState(ApartmentState.STA);
        trayThread.Start();

        if (await CheckStatusAndUpdatesAsync(api, uploader, trayIcon, updateManager, stoppingToken)) return;

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
            var nextCheck = DateTimeOffset.UtcNow + CheckInterval;
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);

                // Flush every 5 minutes (300 seconds)
                if (++counter >= 300)
                {
                    counter = 0;
                    await uploader.FlushAsync(stoppingToken);
                }

                if (DateTimeOffset.UtcNow >= nextCheck)
                {
                    nextCheck = DateTimeOffset.UtcNow + CheckInterval;
                    if (await CheckStatusAndUpdatesAsync(api, uploader, trayIcon, updateManager, stoppingToken)) return;
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

    // Returns true once retired. Runs whether or not League is open.
    private async Task<bool> CheckStatusAndUpdatesAsync(CompanionApi api, GameFiveUploader uploader, TrayIcon trayIcon, UpdateManager updateManager, CancellationToken ct)
    {
        var status = await api.StatusAsync(ct);
        if (CompanionRules.ShouldRetire(status))
        {
            await RetireAsync(status!, uploader, trayIcon, ct);
            return true;
        }

        if (CompanionRules.IsNewer(status?.MinVersion, CompanionConfig.Version))
        {
            _logger.Info($"Running {CompanionConfig.Version} is below minVersion {status!.MinVersion}; checking for an update now.");
        }
        _ = updateManager.CheckForUpdatesAsync(ct);
        return false;
    }

    private async Task RetireAsync(CompanionStatus status, GameFiveUploader uploader, TrayIcon trayIcon, CancellationToken ct)
    {
        _logger.Info("Retire flag set by the server. Retiring.");

        // 1. Drain the upload queue (one last attempt for everything queued).
        uploader.ClearUploadedGameIds();
        await uploader.FlushAsync(ct);

        // 2. Unregister autostart.
        StartupRegistration.Unregister(_logger);

        // 3. One toast linking to the Ceremony.
        var ceremonyUrl = CompanionRules.ResolveUrl(CompanionConfig.ServerBaseUrl, status.CeremonyUrl);
        trayIcon.ShowToast("Mayhem Week is over", "Click to watch the Ceremony. The Companion is removing itself.",
            () => Process.Start(new ProcessStartInfo(ceremonyUrl) { UseShellExecute = true }));
        // shortcut: the toast only reacts to clicks while we are alive; 60 s is the window before we delete ourselves.
        await Task.Delay(TimeSpan.FromSeconds(60), CancellationToken.None);

        // 4. Delete the exe and AppData once this process has exited.
        Process.Start(CompanionRules.RetireCleanup(Environment.ProcessPath, _appPaths.AppDataDirectory, Path.GetTempPath()));
        _logger.Info("Retired; cleanup scheduled. Exiting.");
        trayIcon.Dispose();
        Environment.Exit(0);
    }
}
