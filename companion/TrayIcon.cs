using System.Windows.Forms;
using System.Diagnostics;
using System.Drawing;
using System.Linq;

namespace GameFive.Companion;

internal sealed class TrayIcon : IDisposable
{
    private readonly CompanionLogger _logger;
    private readonly LcuMonitor _monitor;
    private readonly UpdateManager _updateManager;
    private NotifyIcon? _notifyIcon;
    private ContextMenuStrip? _menu;
    private System.Windows.Forms.Timer? _timer;
    private ApplicationContext? _context;
    private string _currentText = "GameFive: Initializing...";
    private bool _isConnected = false;
    private readonly object _lock = new();

    public TrayIcon(CompanionLogger logger, LcuMonitor monitor, UpdateManager updateManager)
    {
        _logger = logger;
        _monitor = monitor;
        _updateManager = updateManager;
    }

    public void SetConnected(bool isConnected)
    {
        lock (_lock) {
            _isConnected = isConnected;
            _currentText = isConnected ? "GameFive: Connected" : "GameFive: Disconnected";
        }
    }

    private void OpenLog()
    {
        var logPath = AppPaths.Create().LogFilePath;
        if (File.Exists(logPath))
        {
            Process.Start(new ProcessStartInfo(logPath) { UseShellExecute = true });
        }
    }

    private void OpenWeb()
    {
        string url = "https://game-five-kohl.vercel.app/";
        
        if (_isConnected)
        {
            // Try to fetch summoner info
            var lockfile = LcuLockfile.TryRead(_logger);
            if (lockfile != null)
            {
                var connection = new LcuConnection { Port = lockfile.Port, AuthToken = lockfile.AuthToken, Protocol = lockfile.Protocol };
                using var client = new LcuClient(connection, _logger);
                
                // Need to run this synchronously or handle it
                // Since this is a button click handler, we can block or run as task
                var summoner = Task.Run(async () => await client.GetCurrentSummonerAsync(CancellationToken.None)).GetAwaiter().GetResult();
                
                if (summoner != null)
                {

                    if (!string.IsNullOrWhiteSpace(summoner.GameName) && !string.IsNullOrWhiteSpace(summoner.TagLine))
                    {
                        url = $"https://game-five-kohl.vercel.app/player/{summoner.GameName}/{summoner.TagLine}";
                    }
                    else if (!string.IsNullOrWhiteSpace(summoner.DisplayName) && summoner.DisplayName.Contains('#'))
                    {
                        var parts = summoner.DisplayName.Split('#');
                        if (parts.Length == 2)
                        {
                            url = $"https://game-five-kohl.vercel.app/player/{parts[0]}/{parts[1]}";
                        }
                    }
                }
            }
        }
        
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    public void Run()
    {
        _logger.Info("Tray icon loop starting.");
        
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        using var connectedStream = assembly.GetManifestResourceStream("GameFive.Companion.connected.ico");
        using var disconnectedStream = assembly.GetManifestResourceStream("GameFive.Companion.disconnected.ico");

        Icon connectedIcon = connectedStream != null ? new Icon(connectedStream) : Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule!.FileName!)!;
        Icon disconnectedIcon = disconnectedStream != null ? new Icon(disconnectedStream) : Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule!.FileName!)!;

        _notifyIcon = new NotifyIcon
        {
            Icon = disconnectedIcon,
            Text = _currentText,
            Visible = true
        };

        _menu = new ContextMenuStrip();
        var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "Unknown";
        _menu.Items.Add($"Version: {version}", null, null).Enabled = false;
        _menu.Items.Add("Reconnect", null, (_, _) => _monitor.Reconnect());
        _menu.Items.Add("Open GameFive", null, (_, _) => OpenWeb());
        _menu.Items.Add("Upload recent games", null, async (_, _) => {
            var lockfile = LcuLockfile.TryRead(_logger);
            if (lockfile != null) {
                var connection = new LcuConnection { Port = lockfile.Port, AuthToken = lockfile.AuthToken, Protocol = lockfile.Protocol };
                await MatchUploaderService.UploadRecentMatchesAsync(connection, _monitor._uploader, CompanionConfig.DiagnosticMatchLimit, _logger);
            }
        });
        _menu.Items.Add("Open Log", null, (_, _) => OpenLog());
        _menu.Items.Add("Check for updates", null, (_, _) => _ = _updateManager.CheckForUpdatesAsync(CancellationToken.None));
        _menu.Items.Add("Exit", null, (_, _) => {
            Application.Exit();
            Environment.Exit(0);
        });

        _notifyIcon.ContextMenuStrip = _menu;

        _context = new ApplicationContext();

        // UI Timer: Updates the text and icon on the UI thread every 500ms
        _timer = new System.Windows.Forms.Timer { Interval = 500 };
        _timer.Tick += (s, e) => {
            lock (_lock) {
                if (_notifyIcon != null) {
                    if (_notifyIcon.Text != _currentText) {
                        _notifyIcon.Text = _currentText;
                    }
                    var expectedIcon = _isConnected ? connectedIcon : disconnectedIcon;
                    if (_notifyIcon.Icon != expectedIcon) {
                        _notifyIcon.Icon = expectedIcon;
                    }
                }
            }
        };
        _timer.Start();

        Application.Run(_context);
    }

    public void Dispose()
    {
        _timer?.Stop();
        _timer?.Dispose();
        if (_notifyIcon != null)
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
        }
        _menu?.Dispose();
        _context?.Dispose();
    }
}
