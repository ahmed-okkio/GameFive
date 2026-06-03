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
}

internal sealed class LcuParticipant
{
    [JsonPropertyName("participantId")]
    public int ParticipantId { get; set; }

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

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
