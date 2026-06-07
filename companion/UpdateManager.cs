using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace GameFive.Companion;

internal sealed class UpdateManager
{
    private readonly CompanionLogger _logger;
    private readonly HttpClient _httpClient;
    private string? _pendingUpdatePath;

    public UpdateManager(CompanionLogger logger)
    {
        _logger = logger;
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "GameFiveCompanion");
    }

    public async Task CheckForUpdatesAsync(CancellationToken ct)
    {
#if DEBUG
        _logger.Info("Auto-update disabled in debug build.");
        await Task.CompletedTask;
        return;
#else
        var currentVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";
        try
        {
            _logger.Info("Checking for updates ...");
            var release = await _httpClient.GetFromJsonAsync<GitHubRelease>("https://api.github.com/repos/ahmed-okkio/GameFive/releases/latest", ct);

            if (release?.TagName == null) return;

            if (IsNewer(release.TagName, currentVersion))
            {
                _logger.Info($"New version found: {release.TagName}. Current version: {currentVersion}");
                var asset = release.Assets.FirstOrDefault(a => a.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase));
                if (asset != null)
                {
                    await DownloadUpdateAsync(asset.BrowserDownloadUrl, ct);
                    ApplyUpdate();
                }
                else
                {
                    _logger.Warn("New version found but no .exe asset found in release.");
                }
            }
            else
            {
                _logger.Info("App is up to date.");
            }
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to check for updates", ex);
        }
#endif
    }

    private bool IsNewer(string latest, string current)
    {
        try
        {
            var l = Version.Parse(latest.TrimStart('v'));
            var c = Version.Parse(current.TrimStart('v'));
            return l > c;
        }
        catch
        {
            return latest != current;
        }
    }

    private async Task DownloadUpdateAsync(string url, CancellationToken ct)
    {
        try
        {
            _logger.Info($"Downloading update from {url}...");
            var response = await _httpClient.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var tempPath = Path.Combine(Path.GetTempPath(), $"GameFive_Update_{Guid.NewGuid():N}.exe");
            using (var fs = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await response.Content.CopyToAsync(fs, ct);
            }

            _pendingUpdatePath = tempPath;
            _logger.Info($"Update downloaded to {_pendingUpdatePath}. Applying immediately.");
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to download update", ex);
        }
    }

    public void ApplyUpdate()
    {
        if (string.IsNullOrEmpty(_pendingUpdatePath) || !File.Exists(_pendingUpdatePath)) return;

        try
        {
            var currentExe = Process.GetCurrentProcess().MainModule?.FileName;
            if (currentExe == null) return;

            var batchPath = Path.Combine(Path.GetTempPath(), "gamefive_update.bat");
            var batchContent = $@"
@echo off
timeout /t 1 /nobreak > nul
move /y ""{_pendingUpdatePath}"" ""{currentExe}""
start """" ""{currentExe}""
del ""%~f0""
";
            File.WriteAllText(batchPath, batchContent);

            var startInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{batchPath}\"",
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            _logger.Info("Starting update script and exiting...");
            Process.Start(startInfo);
            
            // Explicitly exit the application
            Environment.Exit(0);
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to apply update", ex);
        }
    }

    private class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string TagName { get; set; } = "";

        [JsonPropertyName("assets")]
        public List<GitHubAsset> Assets { get; set; } = [];
    }

    private class GitHubAsset
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("browser_download_url")]
        public string BrowserDownloadUrl { get; set; } = "";
    }
}
