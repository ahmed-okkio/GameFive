using System.Diagnostics;
using System.Globalization;

namespace GameFive.Companion;

// Pure decision logic, kept free of WinForms/LCU so the test project can compile it on its own.
internal static class CompanionRules
{
    public const string InstalledExeName = "GameFive.Companion.exe";

    public static bool IsMayhem(int queueId, string? gameType) =>
        queueId == 2400 && string.Equals(gameType, "MATCHED_GAME", StringComparison.Ordinal);

    public static string InstallDirectory(string localAppData) => Path.Combine(localAppData, "GameFive");

    // Null when already running from the install directory; otherwise the path to copy ourselves to.
    public static string? InstallTarget(string currentExePath, string localAppData)
    {
        var installDir = Path.GetFullPath(InstallDirectory(localAppData)).TrimEnd(Path.DirectorySeparatorChar);
        var currentDir = Path.GetDirectoryName(Path.GetFullPath(currentExePath))!.TrimEnd(Path.DirectorySeparatorChar);
        return string.Equals(installDir, currentDir, StringComparison.OrdinalIgnoreCase)
            ? null
            : Path.Combine(installDir, InstalledExeName);
    }

    public static bool IsNewer(string? candidate, string current)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return false;
        return Version.TryParse(candidate.Trim().TrimStart('v'), out var c)
            && Version.TryParse(current.Trim().TrimStart('v'), out var r)
            && c > r;
    }

    // The first-register browser window only opens out of queue and game, never over champ select or a match.
    public static bool PhaseAllowsAutoOpen(string? gameflowPhase) =>
        gameflowPhase is "None" or "Lobby" or "EndOfGame";

    public static bool PhaseAllowsUpdate(string? gameflowPhase) =>
        gameflowPhase is not ("ChampSelect" or "InProgress");

    public static bool NeedsBriefing(string? lastBriefingGmtDay, DateTimeOffset now) =>
        lastBriefingGmtDay != GmtDay(now);

    public static string GmtDay(DateTimeOffset now) => now.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    // Deletes the exe and AppData after we exit. The working directory must be outside AppData,
    // or cmd's own cwd keeps the folder alive and rd leaves it behind.
    public static ProcessStartInfo RetireCleanup(string? exePath, string appDataDirectory, string tempDirectory) => new()
    {
        FileName = "cmd.exe",
        Arguments = $"/c timeout /t 2 > NUL & del /f /q \"{exePath}\" & rd /s /q \"{appDataDirectory}\"",
        WorkingDirectory = tempDirectory,
        WindowStyle = ProcessWindowStyle.Hidden,
        CreateNoWindow = true,
        UseShellExecute = false
    };

    // A queued game leaves the queue only on a final answer: any 2xx (stored, duplicate, not_mayhem, remake,
    // not_entrant) or 400 (the payload will never be accepted). 401/403 is a token/config problem and 5xx,
    // 503 maintenance, other codes and network errors are transient, so the game stays queued for the next flush.
    public static bool IsFinalUploadAnswer(int statusCode) => statusCode is >= 200 and < 300 or 400;

    // The site opens by itself once per install and PUUID; openedPuuids is the file of PUUIDs already opened, one per line.
    public static bool ShouldAutoOpenSite(string? openedPuuids, string puuid) =>
        !(openedPuuids ?? "").Split('\n', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Contains(puuid);

    // Only an explicit retire: true retires; a failed or unreadable status call is null.
    public static bool ShouldRetire(CompanionStatus? status) => status?.Retire == true;
}

internal sealed class CompanionStatus
{
    [System.Text.Json.Serialization.JsonPropertyName("retire")]
    public bool Retire { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("ceremonyUrl")]
    public string? CeremonyUrl { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("minVersion")]
    public string? MinVersion { get; set; }
}
