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

    public static bool PhaseAllowsUpdate(string? gameflowPhase) =>
        gameflowPhase is not ("ChampSelect" or "InProgress");

    public static bool NeedsBriefing(string? lastBriefingGmtDay, DateTimeOffset now) =>
        lastBriefingGmtDay != GmtDay(now);

    public static string GmtDay(DateTimeOffset now) => now.UtcDateTime.ToString("yyyy-MM-dd");

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
