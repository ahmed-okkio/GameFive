using System.Diagnostics;
using System.Timers;

namespace GameFive.Companion;

internal sealed class LcuMonitor : IDisposable
{
    public readonly GameFiveUploader _uploader;
    private readonly CompanionLogger _logger;
    private LcuConnection? _connection;
    private LcuService? _service;
    private readonly System.Timers.Timer _timer;
    private bool _wasRunning = false;

    public event EventHandler<LcuStatus>? StatusChanged;

    public LcuMonitor(CompanionLogger logger, GameFiveUploader uploader)
    {
        _logger = logger;
        _uploader = uploader;
        
        _timer = new System.Timers.Timer(5000);
        _timer.Elapsed += CheckLeagueProcess;
    }

    public void Start()
    {
        _logger.Info("Starting polling monitor for LeagueClient.exe...");
        _timer.Start();
    }

    public void Reconnect()
    {
        _logger.Info("Manual reconnect requested.");
        CleanupConnection();
        // Force a fresh check
        CheckLeagueProcess(null, null!);
    }

    public void Stop()
    {
        _timer.Stop();
        CleanupConnection();
    }

    private void CheckLeagueProcess(object? sender, ElapsedEventArgs e)
    {
        var processes = Process.GetProcessesByName("LeagueClient");
        bool isRunning = processes.Length > 0;

        if (isRunning && !_wasRunning)
        {
            _logger.Info("LeagueClient detected.");
            InitializeConnection();
        }
        else if (!isRunning && _wasRunning)
        {
            _logger.Info("LeagueClient closed.");
            CleanupConnection();
        }

        _wasRunning = isRunning;
    }

    private void InitializeConnection()
    {
        _ = Task.Run(async () =>
        {
            for (int i = 0; i < 3; i++) // Try 3 times to connect
            {
                var lockfile = LcuLockfile.TryRead(_logger);
                if (lockfile != null)
                {
                    _logger.Info($"Lockfile read: Port={lockfile.Port}, Protocol={lockfile.Protocol}");
                    
                    var lcuConnection = new LcuConnection { Port = lockfile.Port, AuthToken = lockfile.AuthToken, Protocol = lockfile.Protocol };
                    
                    var lcuService = new LcuService(lcuConnection, _logger, _uploader, (isConnected) => {
                        _logger.Info($"StatusChanged invoked: Connected={isConnected}");
                        StatusChanged?.Invoke(this, isConnected ? LcuStatus.Connected : LcuStatus.Disconnected);
                    });
                    
                    try {
                        if (await lcuService.ConnectAsync(CancellationToken.None))
                        {
                            _connection = lcuConnection;
                            _service = lcuService;
                            _logger.Info("LCU Service connected successfully.");
                            return; // Success!
                        }
                        else 
                        {
                            _logger.Warn("LcuService returned false on ConnectAsync.");
                            lcuService.Dispose();
                        }
                    } catch (Exception ex) {
                        _logger.Error($"Exception during ConnectAsync: {ex.Message}", ex);
                        lcuService.Dispose();
                    }
                }
                else {
                    _logger.Warn("LcuLockfile.TryRead returned null.");
                }
                
                _logger.Warn($"Connection attempt {i+1} failed. Retrying in 5 seconds...");
                await Task.Delay(5000);
            }
            _logger.Error("Failed to connect to LCU after 3 attempts.");
        });
    }

    private void CleanupConnection()
    {
        _service?.Dispose();
        _service = null;
        _connection = null;
        _wasRunning = false; // Add this line
        StatusChanged?.Invoke(this, LcuStatus.Disconnected);
    }

    public void Dispose()
    {
        Stop();
        _timer.Dispose();
    }
}
