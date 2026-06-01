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

        var match = await client.GetMostRecentMatchAsync(puuid, CancellationToken.None);
        if (match == null)
        {
            logger.Info("No recent matches found.");
            return;
        }

        logger.Info("LATEST MATCH PAYLOAD:");
        logger.Info(JsonSerializer.Serialize(match, new JsonSerializerOptions { WriteIndented = true }));
    }
}
