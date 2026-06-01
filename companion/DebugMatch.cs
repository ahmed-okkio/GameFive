using System.Text.Json;

namespace GameFive.Companion;

internal static class DebugMatch
{
    public static async Task Run(CompanionLogger logger, LcuConnection connection)
    {
        using var client = new LcuClient(connection, logger);
        var puuid = await client.GetCurrentPuuidAsync(CancellationToken.None);
        if (string.IsNullOrEmpty(puuid))
        {
            logger.Info("No PUUID found.");
            return;
        }

        var matchSummary = await client.GetMostRecentMatchAsync(puuid, CancellationToken.None);
        if (matchSummary == null)
        {
            logger.Info("No recent matches found.");
            return;
        }

        // Fetch full match details to ensure we see participant data
        var fullMatch = await client.TryGetMatchDetailsAsync(matchSummary.GameId, CancellationToken.None);
        
        logger.Info("FULL LCU MATCH DETAILS (Raw API Response):");
        logger.Info(JsonSerializer.Serialize(fullMatch, new JsonSerializerOptions { WriteIndented = true }));
    }
}
