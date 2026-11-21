using System.Text.Json;
using GameFive.Companion;

namespace GameFive.Companion.Tests;

public class CompanionRulesTests
{
    [Theory]
    [InlineData(2400, "MATCHED_GAME", true)]
    [InlineData(2400, "CUSTOM_GAME", false)]
    [InlineData(3270, "CUSTOM_GAME", false)]
    [InlineData(2400, null, false)]
    public void OnlyQueue2400MatchedGamesAreMayhem(int queueId, string? gameType, bool expected) =>
        Assert.Equal(expected, CompanionRules.IsMayhem(queueId, gameType));

    [Fact]
    public void RunFromDownloadsInstallsIntoLocalAppDataGameFive()
    {
        var target = CompanionRules.InstallTarget(@"C:\Users\x\Downloads\GameFive.Companion.exe", @"C:\Users\x\AppData\Local");
        Assert.Equal(@"C:\Users\x\AppData\Local\GameFive\GameFive.Companion.exe", target);
    }

    [Fact]
    public void DownloadedFileNameDoesNotMatter()
    {
        var target = CompanionRules.InstallTarget(@"C:\Users\x\Downloads\GameFive.Companion (1).exe", @"C:\Users\x\AppData\Local");
        Assert.Equal(@"C:\Users\x\AppData\Local\GameFive\GameFive.Companion.exe", target);
    }

    [Theory]
    [InlineData(@"C:\Users\x\AppData\Local\GameFive\GameFive.Companion.exe")]
    [InlineData(@"c:\users\X\appdata\local\gamefive\GameFive.Companion.exe")]
    public void RunFromInstallDirectoryDoesNotReinstall(string exe) =>
        Assert.Null(CompanionRules.InstallTarget(exe, @"C:\Users\x\AppData\Local"));

    [Theory]
    [InlineData("5.0.1", "5.0.0", true)]
    [InlineData("v5.1.0", "5.0.0", true)]
    [InlineData("5.0.0", "5.0.0", false)]
    [InlineData("4.0.0", "5.0.0", false)]
    [InlineData("5.0.10", "5.0.9", true)]
    [InlineData(null, "5.0.0", false)]
    [InlineData("", "5.0.0", false)]
    [InlineData("garbage", "5.0.0", false)]
    public void VersionCompare(string? candidate, string current, bool expected) =>
        Assert.Equal(expected, CompanionRules.IsNewer(candidate, current));

    [Theory]
    [InlineData("ChampSelect", false)]
    [InlineData("InProgress", false)]
    [InlineData("None", true)]
    [InlineData("Lobby", true)]
    [InlineData("EndOfGame", true)]
    [InlineData(null, true)]
    public void UpdatesWaitOutChampSelectAndGames(string? phase, bool expected) =>
        Assert.Equal(expected, CompanionRules.PhaseAllowsUpdate(phase));

    [Fact]
    public void BriefingOnFirstConnectOfEachGmtDay()
    {
        var lateEvening = new DateTimeOffset(2026, 12, 25, 23, 30, 0, TimeSpan.FromHours(-2)); // Dec 26 01:30 GMT
        Assert.True(CompanionRules.NeedsBriefing(null, lateEvening));
        Assert.True(CompanionRules.NeedsBriefing("2026-12-25", lateEvening));
        Assert.False(CompanionRules.NeedsBriefing("2026-12-26", lateEvening));
        Assert.Equal("2026-12-26", CompanionRules.GmtDay(lateEvening));
    }

    [Theory]
    [InlineData("{\"retire\":true,\"ceremonyUrl\":\"https://x/ceremony\",\"minVersion\":\"5.0.0\"}", true)]
    [InlineData("{\"retire\":false,\"ceremonyUrl\":null,\"minVersion\":\"5.0.0\"}", false)]
    [InlineData("{\"ceremonyUrl\":\"https://x/ceremony\"}", false)]
    [InlineData("{}", false)]
    public void RetiresOnlyOnExplicitTrue(string json, bool expected) =>
        Assert.Equal(expected, CompanionRules.ShouldRetire(JsonSerializer.Deserialize<CompanionStatus>(json)));

    [Fact]
    public void UnreachableStatusNeverRetires() => Assert.False(CompanionRules.ShouldRetire(null));
}

public class CompanionRulesFixTests
{
    [Fact]
    public void GmtDayIsGregorianWhateverTheCulture()
    {
        var saved = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("ar-SA"); // Um Al-Qura calendar
            Assert.Equal("2026-12-26", CompanionRules.GmtDay(new DateTimeOffset(2026, 12, 26, 1, 0, 0, TimeSpan.Zero)));
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = saved;
        }
    }

    [Fact]
    public void StatusWithNullsDoesNotRetireOrForceUpdate()
    {
        var status = JsonSerializer.Deserialize<CompanionStatus>("{\"retire\":false,\"ceremonyUrl\":null,\"minVersion\":null}");
        Assert.False(CompanionRules.ShouldRetire(status));
        Assert.False(CompanionRules.IsNewer(status!.MinVersion, "5.0.0"));
    }

    [Fact]
    public void RetireCleanupRunsOutsideTheFolderItDeletes()
    {
        var appData = @"C:\Users\x\AppData\Local\GameFive";
        var psi = CompanionRules.RetireCleanup(appData + @"\GameFive.Companion.exe", appData, @"C:\Users\x\AppData\Local\Temp\");
        Assert.Equal(@"C:\Users\x\AppData\Local\Temp\", psi.WorkingDirectory);
        Assert.False(psi.WorkingDirectory.StartsWith(appData + @"\", StringComparison.OrdinalIgnoreCase));
        Assert.Contains($"rd /s /q \"{appData}\"", psi.Arguments);
        Assert.Contains("del /f /q \"" + appData + "\\GameFive.Companion.exe\"", psi.Arguments);
    }
}
