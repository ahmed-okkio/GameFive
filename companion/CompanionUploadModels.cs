using System.Text.Json.Serialization;

namespace GameFive.Companion;

internal sealed class CompanionMatchUpload
{
    [JsonPropertyName("source")]
    public string Source { get; set; } = "lcu";

    [JsonPropertyName("uploaderPuuid")]
    public string UploaderPuuid { get; set; } = "";

    [JsonPropertyName("gameId")]
    public long GameId { get; set; }

    [JsonPropertyName("queueId")]
    public int QueueId { get; set; }

    [JsonPropertyName("gameMode")]
    public string? GameMode { get; set; }

    [JsonPropertyName("mapId")]
    public int MapId { get; set; }

    [JsonPropertyName("gameCreation")]
    public long GameCreation { get; set; }

    [JsonPropertyName("gameDuration")]
    public int GameDuration { get; set; }

    [JsonPropertyName("participants")]
    public List<CompanionParticipantUpload> Participants { get; set; } = [];
}

internal sealed class CompanionParticipantUpload
{
    [JsonPropertyName("puuid")]
    public string Puuid { get; set; } = "";

    [JsonPropertyName("gameName")]
    public string? GameName { get; set; }

    [JsonPropertyName("tagLine")]
    public string? TagLine { get; set; }

    [JsonPropertyName("summonerName")]
    public string? SummonerName { get; set; }

    [JsonPropertyName("participantId")]
    public int ParticipantId { get; set; }

    [JsonPropertyName("teamId")]
    public int TeamId { get; set; }

    [JsonPropertyName("championId")]
    public int ChampionId { get; set; }

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
