using System.Diagnostics;
using System.Timers;

namespace GameFive.Companion;

internal sealed class LcuMonitor : IDisposable
{
    public readonly GameFiveUploader _uploader;
    private readonly CompanionLogger _logger;
    private readonly CompanionApi _api;
    private readonly AppPaths _paths;
    private readonly Action<string, string, Action> _showToast;
    private LcuService? _service;
    private readonly System.Timers.Timer _timer;
    private bool _wasRunning = false;

    public event EventHandler<LcuStatus>? StatusChanged;

    public LcuMonitor(CompanionLogger logger, GameFiveUploader uploader, CompanionApi api, AppPaths paths, Action<string, string, Action> showToast)
    {
        _logger = logger;
        _uploader = uploader;
        _api = api;
        _paths = paths;
        _showToast = showToast;
        _uploader.Uploaded += () => _ = _service?.PollInboxAsync();

        _timer = new System.Timers.Timer(5000);
        _timer.Elapsed += CheckLeagueProcess;
    }

    // The connected Entrant's PUUID, or null while the client is closed or not logged in.
    public string? Puuid => _service?.Puuid;

    // Null when the client is not connected (or the call fails), which allows an update.
    public async Task<string?> GetGameflowPhaseAsync()
    {
        var service = _service;
        if (service is null) return null;
        try { return await service.GetGameflowPhaseAsync(); }
        catch (Exception) { return null; }
    }

    public void Start()
    {
        _logger.Info("Starting polling monitor for LeagueClient.exe...");
        _timer.Start();
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

                    var lcuService = new LcuService(lcuConnection, _logger, _uploader, _api, _paths, _showToast, (isConnected) => {
                        _logger.Info($"StatusChanged invoked: Connected={isConnected}");
                        StatusChanged?.Invoke(this, isConnected ? LcuStatus.Connected : LcuStatus.Disconnected);
                    });

                    // Set before connecting: ConnectAsync only returns once the socket closes.
                    _service = lcuService;
                    try {
                        if (await lcuService.ConnectAsync())
                        {
                            _logger.Info("LCU Service session ended.");
                            return;
                        }
                        else
                        {
                            _logger.Warn("LcuService returned false on ConnectAsync.");
                        }
                    } catch (Exception ex) {
                        _logger.Error($"Exception during ConnectAsync: {ex.Message}", ex);
                    }
                    if (_service == lcuService) _service = null;
                    lcuService.Dispose();
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
        _wasRunning = false;
        StatusChanged?.Invoke(this, LcuStatus.Disconnected);
    }

    public void Dispose()
    {
        Stop();
        _timer.Dispose();
    }
}
