using System.Windows.Forms;
using System.Diagnostics;
using System.Drawing;

namespace GameFive.Companion;

internal sealed class TrayIcon : IDisposable
{
    private readonly CompanionLogger _logger;
    private readonly LcuMonitor _monitor;
    private readonly UpdateManager _updateManager;
    private readonly CompanionApi _api;
    private readonly ManualResetEventSlim _ready = new();
    private NotifyIcon? _notifyIcon;
    private ContextMenuStrip? _menu;
    private ToolStripItem? _statusItem;
    private System.Windows.Forms.Timer? _timer;
    private ApplicationContext? _context;
    private SynchronizationContext? _ui;
    private Action? _onBalloonClick;
    private bool _isConnected = false;
    private readonly object _lock = new();

    public TrayIcon(CompanionLogger logger, LcuMonitor monitor, UpdateManager updateManager, CompanionApi api)
    {
        _logger = logger;
        _monitor = monitor;
        _updateManager = updateManager;
        _api = api;
    }

    private static string StatusText(bool connected) =>
        $"GameFive {CompanionConfig.Version}: {(connected ? "Connected" : "Disconnected")}";

    public void SetConnected(bool isConnected)
    {
        lock (_lock) {
            _isConnected = isConnected;
        }
    }

    // Thread-safe; one balloon at a time, a click runs onClick.
    public void ShowToast(string title, string body, Action onClick)
    {
        if (!_ready.Wait(TimeSpan.FromSeconds(30)) || _ui is null) return;
        _ui.Post(_ =>
        {
            if (_notifyIcon is null) return;
            _onBalloonClick = onClick;
            // ShowBalloonTip rejects empty text.
            _notifyIcon.ShowBalloonTip(10000, title, string.IsNullOrWhiteSpace(body) ? " " : body, ToolTipIcon.None);
        }, null);
    }

    private void OpenLog()
    {
        var logPath = AppPaths.Create().LogFilePath;
        if (File.Exists(logPath))
        {
            Process.Start(new ProcessStartInfo(logPath) { UseShellExecute = true });
        }
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
            Text = StatusText(false),
            Visible = true
        };
        _notifyIcon.BalloonTipClicked += (_, _) =>
        {
            var onClick = _onBalloonClick;
            _onBalloonClick = null;
            onClick?.Invoke();
        };

        _menu = new ContextMenuStrip();
        _ui = SynchronizationContext.Current; // installed by the first WinForms control above
        _statusItem = _menu.Items.Add(StatusText(false), null, null);
        _statusItem.Enabled = false;
        _menu.Items.Add("Open Mayhem Week", null, (_, _) => _ = _api.OpenAsEntrantAsync(_monitor.Puuid, "/"));
        _menu.Items.Add("Upload recent games", null, async (_, _) => {
            var lockfile = LcuLockfile.TryRead(_logger);
            if (lockfile != null) {
                var connection = new LcuConnection { Port = lockfile.Port, AuthToken = lockfile.AuthToken, Protocol = lockfile.Protocol };
                await MatchUploaderService.UploadRecentMatchesAsync(connection, _monitor._uploader, CompanionConfig.DiagnosticMatchLimit, _logger);
            }
        });
        _menu.Items.Add("Check for updates", null, (_, _) => _ = _updateManager.CheckForUpdatesAsync(CancellationToken.None));
        _menu.Items.Add("Open log", null, (_, _) => OpenLog());
        _menu.Items.Add("Exit", null, (_, _) => {
            Application.Exit();
            Environment.Exit(0);
        });

        _notifyIcon.ContextMenuStrip = _menu;

        _context = new ApplicationContext();

        // UI Timer: Updates the status text and icon on the UI thread every 500ms
        _timer = new System.Windows.Forms.Timer { Interval = 500 };
        _timer.Tick += (s, e) => {
            lock (_lock) {
                if (_notifyIcon != null) {
                    var text = StatusText(_isConnected);
                    if (_notifyIcon.Text != text) {
                        _notifyIcon.Text = text;
                        _statusItem.Text = text;
                    }
                    var expectedIcon = _isConnected ? connectedIcon : disconnectedIcon;
                    if (_notifyIcon.Icon != expectedIcon) {
                        _notifyIcon.Icon = expectedIcon;
                    }
                }
            }
        };
        _timer.Start();
        _ready.Set();

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
