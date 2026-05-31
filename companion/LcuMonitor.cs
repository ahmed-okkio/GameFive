using System.Diagnostics;
using System.Timers;

namespace GameFive.Companion;

internal sealed class LcuMonitor : IDisposable
{
    private readonly CompanionConfig _config;
    private readonly CompanionLogger _logger;
    private readonly GameFiveUploader _uploader;
    private LcuConnection? _connection;
    private readonly System.Timers.Timer _timer;
    private bool _wasRunning = false;

    public event EventHandler<LcuStatus>? StatusChanged;

    public LcuMonitor(CompanionConfig config, CompanionLogger logger, GameFiveUploader uploader)
    {
        _config = config;
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

    public void Stop()
    {
        _timer.Stop();
        _connection?.Dispose();
        _connection = null;
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
        var lockfile = LcuLockfile.TryRead(_logger);
        if (lockfile != null)
        {
            _logger.Info("Lockfile read successfully, initiating connection...");
            var lcuConnection = new LcuConnection { Port = lockfile.Port, AuthToken = lockfile.AuthToken, Protocol = lockfile.Protocol };
            var lcuService = new LcuService(lcuConnection, _logger, _uploader, (isConnected) => {
                _logger.Info($"StatusChanged invoked: Connected={isConnected}");
                StatusChanged?.Invoke(this, isConnected ? LcuStatus.Connected : LcuStatus.Disconnected);
            });
            lcuService.Connect();
            
            _connection = lcuConnection; 
        }
        else
        {
            _logger.Warn("InitializeConnection: lockfile was null.");
        }
    }

    private void CleanupConnection()
    {
        _connection?.Dispose();
        _connection = null;
        StatusChanged?.Invoke(this, LcuStatus.Disconnected);
    }

    public void Dispose()
    {
        Stop();
        _timer.Dispose();
    }
}
