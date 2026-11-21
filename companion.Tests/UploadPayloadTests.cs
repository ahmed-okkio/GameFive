using System.Text.Json;
using GameFive.Companion;

namespace GameFive.Companion.Tests;

public class UploadPayloadTests
{
    private static LcuGame TenPlayerGame() => new()
    {
        GameId = 8041594522,
        QueueId = 2400,
        GameType = "MATCHED_GAME",
        GameMode = "KIWI",
        GameDuration = 1100,
        Participants = Enumerable.Range(1, 10).Select(i => new LcuParticipant
        {
            ParticipantId = i, TeamId = i <= 5 ? 100 : 200, ChampionId = i, Stats = new LcuParticipantStats { Win = i <= 5 }
        }).ToList(),
        ParticipantIdentities = Enumerable.Range(1, 10).Select(i => new LcuParticipantIdentity
        {
            ParticipantId = i, Player = new LcuPlayer { Puuid = $"puuid-{i}" }
        }).ToList()
    };

    [Fact]
    public void UploadCarriesAllTenPlayersGameTypeAndEndOfGameStats()
    {
        // Shape of localPlayer.stats in /lol-end-of-game/v1/eog-stats-block (captured 2026-11-09).
        using var eog = JsonDocument.Parse("{\"TOTAL_HEAL_ON_TEAMMATES\":1234,\"TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES\":567,\"NUM_DEATHS\":9}");

        var upload = MatchMapper.ToUpload(TenPlayerGame(), "puuid-1", eog.RootElement.Clone());
        var json = JsonDocument.Parse(JsonSerializer.Serialize(upload)).RootElement;

        Assert.Equal(10, json.GetProperty("participants").GetArrayLength());
        Assert.Equal("MATCHED_GAME", json.GetProperty("gameType").GetString());
        var stats = json.GetProperty("endOfGameStats");
        Assert.Equal(1234, stats.GetProperty("TOTAL_HEAL_ON_TEAMMATES").GetInt32());
        Assert.Equal(567, stats.GetProperty("TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES").GetInt32());
    }

    [Fact]
    public void BackfillUploadOmitsEndOfGameStats()
    {
        var json = JsonSerializer.Serialize(MatchMapper.ToUpload(TenPlayerGame(), "puuid-1"));
        Assert.DoesNotContain("endOfGameStats", json);
    }

    [Fact]
    public void QueuedUploadRoundTripsEndOfGameStats()
    {
        using var eog = JsonDocument.Parse("{\"TOTAL_HEAL_ON_TEAMMATES\":1}");
        var json = JsonSerializer.Serialize(MatchMapper.ToUpload(TenPlayerGame(), "puuid-1", eog.RootElement.Clone()));
        var back = JsonSerializer.Deserialize<CompanionMatchUpload>(json)!;
        Assert.Equal(1, back.EndOfGameStats!.Value.GetProperty("TOTAL_HEAL_ON_TEAMMATES").GetInt32());
    }
}
