using System.Management;
using System.Diagnostics;

namespace GameFive.Companion;

internal sealed class LcuMonitor : IDisposable
{
    private readonly CompanionConfig _config;
    private readonly CompanionLogger _logger;
    private readonly GameFiveUploader _uploader;
    private ManagementEventWatcher? _startWatcher;
    private ManagementEventWatcher? _stopWatcher;
    private LcuConnection? _connection;

    public event EventHandler<LcuStatus>? StatusChanged;

    public LcuMonitor(CompanionConfig config, CompanionLogger logger, GameFiveUploader uploader)
    {
        _config = config;
        _logger = logger;
        _uploader = uploader;
    }

    public void Start()
    {
        _logger.Info("Starting WMI monitors for LeagueClient.exe...");

        // Check for already running LeagueClient
        var existingProcesses = Process.GetProcessesByName("LeagueClient");
        if (existingProcesses.Length > 0)
        {
            _logger.Info($"Found {existingProcesses.Length} existing LeagueClient process(es). Initializing...");
            InitializeConnection();
        }

        var startQuery = new WqlEventQuery("SELECT * FROM Win32_ProcessStartTrace WHERE ProcessName = 'LeagueClient.exe'");
        _startWatcher = new ManagementEventWatcher(startQuery);
        _startWatcher.EventArrived += OnLeagueClientStarted;
        _startWatcher.Start();

        var stopQuery = new WqlEventQuery("SELECT * FROM Win32_ProcessStopTrace WHERE ProcessName = 'LeagueClient.exe'");
        _stopWatcher = new ManagementEventWatcher(stopQuery);
        _stopWatcher.EventArrived += OnLeagueClientStopped;
        _stopWatcher.Start();
    }

    public void Stop()
    {
        _startWatcher?.Stop();
        _stopWatcher?.Stop();
    }

    private void OnLeagueClientStarted(object sender, EventArrivedEventArgs e)
    {
        _logger.Info("LeagueClient started. Initializing LCU connection...");
        InitializeConnection();
    }

    private void OnLeagueClientStopped(object sender, EventArrivedEventArgs e)
    {
        _logger.Info("LeagueClient stopped. Cleaning up.");
        _connection?.Dispose();
        _connection = null;
        StatusChanged?.Invoke(this, LcuStatus.Disconnected);
    }

    private void InitializeConnection()
    {
        _logger.Info("InitializingConnection method called.");
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

    public void Dispose()
    {
        _startWatcher?.Dispose();
        _stopWatcher?.Dispose();
        _connection?.Dispose();
    }
}

