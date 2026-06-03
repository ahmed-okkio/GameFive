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
            Teams = match.Teams.Cast<object>().ToList(),
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
                    GoldEarned = participant.Stats.GoldEarned,
                    Spell1Id = participant.Spell1Id,
                    Spell2Id = participant.Spell2Id,
                    ChampLevel = participant.Stats.ChampLevel,
                    GoldSpent = participant.Stats.GoldSpent,
                    DamageTaken = participant.Stats.TotalDamageTaken,
                    SelfMitigated = participant.Stats.DamageSelfMitigated,
                    MinionsKilled = participant.Stats.TotalMinionsKilled,
                    Items = new List<int>
                    {
                        participant.Stats.Item0,
                        participant.Stats.Item1,
                        participant.Stats.Item2,
                        participant.Stats.Item3,
                        participant.Stats.Item4,
                        participant.Stats.Item5,
                        participant.Stats.Item6
                    },
                    Augments = new List<int>
                    {
                        participant.Stats.PlayerAugment1,
                        participant.Stats.PlayerAugment2,
                        participant.Stats.PlayerAugment3,
                        participant.Stats.PlayerAugment4,
                        participant.Stats.PlayerAugment5,
                        participant.Stats.PlayerAugment6
                    }.Where(a => a > 0).ToList()
                };
            }).Where(participant => !string.IsNullOrWhiteSpace(participant.Puuid)).ToList()
        };
    }
}
