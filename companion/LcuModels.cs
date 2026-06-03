using System.Text.Json.Serialization;

namespace GameFive.Companion;

internal sealed class LcuSummoner
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = "";
    
    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = "";
}

internal sealed class LcuMatchHistoryResponse
{
    [JsonPropertyName("games")]
    public LcuGames Games { get; set; } = new();
}

internal sealed class LcuGames
{
    [JsonPropertyName("games")]
    public List<LcuGame> Items { get; set; } = [];
}

internal sealed class LcuGame
{
    [JsonPropertyName("gameId")]
    public long GameId { get; set; }

    [JsonPropertyName("gameCreation")]
    public long GameCreation { get; set; }

    [JsonPropertyName("gameDuration")]
    public int GameDuration { get; set; }

    [JsonPropertyName("queueId")]
    public int QueueId { get; set; }

    [JsonPropertyName("gameMode")]
    public string? GameMode { get; set; }

    [JsonPropertyName("mapId")]
    public int MapId { get; set; }

    [JsonPropertyName("participants")]
    public List<LcuParticipant> Participants { get; set; } = [];

    [JsonPropertyName("participantIdentities")]
    public List<LcuParticipantIdentity> ParticipantIdentities { get; set; } = [];

    [JsonPropertyName("teams")]
    public List<LcuTeam> Teams { get; set; } = [];
}

internal sealed class LcuTeam
{
    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("win")]
    public string? Win { get; set; }

    [JsonExtensionData]
    public Dictionary<string, object>? ExtraData { get; set; }
}

internal sealed class LcuParticipant
{
    [JsonPropertyName("participantId")]
    public int ParticipantId { get; set; }

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

    [JsonPropertyName("spell1Id")]
    public int Spell1Id { get; set; }

    [JsonPropertyName("spell2Id")]
    public int Spell2Id { get; set; }

    [JsonPropertyName("stats")]
    public LcuParticipantStats Stats { get; set; } = new();
}

internal sealed class LcuParticipantStats
{
    [JsonPropertyName("win")]
    public bool Win { get; set; }

    [JsonPropertyName("kills")]
    public int Kills { get; set; }

    [JsonPropertyName("deaths")]
    public int Deaths { get; set; }

    [JsonPropertyName("assists")]
    public int Assists { get; set; }

    [JsonPropertyName("totalDamageDealtToChampions")]
    public int TotalDamageDealtToChampions { get; set; }

    [JsonPropertyName("totalHeal")]
    public int TotalHeal { get; set; }

    [JsonPropertyName("goldEarned")]
    public int GoldEarned { get; set; }

    [JsonPropertyName("item0")]
    public int Item0 { get; set; }

    [JsonPropertyName("item1")]
    public int Item1 { get; set; }

    [JsonPropertyName("item2")]
    public int Item2 { get; set; }

    [JsonPropertyName("item3")]
    public int Item3 { get; set; }

    [JsonPropertyName("item4")]
    public int Item4 { get; set; }

    [JsonPropertyName("item5")]
    public int Item5 { get; set; }

    [JsonPropertyName("item6")]
    public int Item6 { get; set; }

    [JsonPropertyName("playerAugment1")]
    public int PlayerAugment1 { get; set; }

    [JsonPropertyName("playerAugment2")]
    public int PlayerAugment2 { get; set; }

    [JsonPropertyName("playerAugment3")]
    public int PlayerAugment3 { get; set; }

    [JsonPropertyName("playerAugment4")]
    public int PlayerAugment4 { get; set; }

    [JsonPropertyName("playerAugment5")]
    public int PlayerAugment5 { get; set; }

    [JsonPropertyName("playerAugment6")]
    public int PlayerAugment6 { get; set; }

    [JsonPropertyName("champLevel")]
    public int ChampLevel { get; set; }

    [JsonPropertyName("goldSpent")]
    public int GoldSpent { get; set; }

    [JsonPropertyName("totalDamageTaken")]
    public int TotalDamageTaken { get; set; }

    [JsonPropertyName("damageSelfMitigated")]
    public int DamageSelfMitigated { get; set; }

    [JsonPropertyName("totalMinionsKilled")]
    public int TotalMinionsKilled { get; set; }
}

internal sealed class LcuParticipantIdentity
{
    [JsonPropertyName("participantId")]
    public int ParticipantId { get; set; }

    [JsonPropertyName("player")]
    public LcuPlayer Player { get; set; } = new();
}

internal sealed class LcuPlayer
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = "";

    [JsonPropertyName("gameName")]
    public string? GameName { get; set; }

    [JsonPropertyName("tagLine")]
    public string? TagLine { get; set; }

    [JsonPropertyName("summonerName")]
    public string? SummonerName { get; set; }
}
