using System.Windows.Forms;
using System.Diagnostics;
using System.Drawing;

namespace GameFive.Companion;

internal sealed class TrayIcon : IDisposable
{
    private readonly CompanionLogger _logger;
    private NotifyIcon? _notifyIcon;
    private ContextMenuStrip? _menu;
    private System.Windows.Forms.Timer? _timer;
    private ApplicationContext? _context;
    private string _currentText = "GameFive: Initializing...";
    private readonly object _lock = new();

    public TrayIcon(CompanionLogger logger)
    {
        _logger = logger;
    }

    public void SetConnected(bool isConnected)
    {
        lock (_lock) {
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

    public void Run()
    {
        _logger.Info("Tray icon loop starting.");
        
        // Use the icon embedded in the executable via <ApplicationIcon>
        _notifyIcon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule!.FileName!),
            Text = _currentText,
            Visible = true
        };

        _menu = new ContextMenuStrip();
        _menu.Items.Add("Open Log", null, (_, _) => OpenLog());
        _menu.Items.Add("Exit", null, (_, _) => {
            Application.Exit();
            Environment.Exit(0);
        });

        _notifyIcon.ContextMenuStrip = _menu;
        _context = new ApplicationContext();

        // UI Timer: Updates the text on the UI thread every 500ms
        _timer = new System.Windows.Forms.Timer { Interval = 500 };
        _timer.Tick += (s, e) => {
            lock (_lock) {
                if (_notifyIcon != null && _notifyIcon.Text != _currentText) {
                    _notifyIcon.Text = _currentText;
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
