namespace GameFive.Companion;

internal static class MatchMapper
{
    public static bool IsLikelyMayhem(LcuGame match)
    {
        return match.QueueId == 2400 || string.Equals(match.GameMode, "KIWI", StringComparison.OrdinalIgnoreCase);
    }

    public static CompanionMatchUpload ToUpload(LcuGame match, string uploaderPuuid)
    {
        var identities = match.ParticipantIdentities.ToDictionary(identity => identity.ParticipantId, identity => identity.Player);

        return new CompanionMatchUpload
        {
            UploaderPuuid = uploaderPuuid,
            GameId = match.GameId,
            QueueId = match.QueueId,
            GameMode = match.GameMode,
            MapId = match.MapId,
            GameCreation = match.GameCreation,
            GameDuration = match.GameDuration,
            Participants = match.Participants.Select(participant =>
            {
                identities.TryGetValue(participant.ParticipantId, out var player);

                return new CompanionParticipantUpload
                {
                    Puuid = player?.Puuid ?? "",
                    GameName = player?.GameName,
                    TagLine = player?.TagLine,
                    SummonerName = player?.SummonerName,
                    ParticipantId = participant.ParticipantId,
                    TeamId = participant.TeamId,
                    ChampionId = participant.ChampionId,
                    Win = participant.Stats.Win,
                    Kills = participant.Stats.Kills,
                    Deaths = participant.Stats.Deaths,
                    Assists = participant.Stats.Assists,
                    TotalDamageDealtToChampions = participant.Stats.TotalDamageDealtToChampions,
                    TotalHeal = participant.Stats.TotalHeal,
                    GoldEarned = participant.Stats.GoldEarned
                };
            }).Where(participant => !string.IsNullOrWhiteSpace(participant.Puuid)).ToList()
        };
    }
}
