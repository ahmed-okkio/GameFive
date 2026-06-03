using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace GameFive.Companion;

internal static class DiagnosticCollector
{
    public static async Task CollectAsync(CompanionLogger logger, LcuConnection connection, int matchLimit)
    {
        logger.Info($"Starting manual diagnostic match collection (Limit: {matchLimit})...");
        using var client = new LcuClient(connection, logger);

        try 
        {
            var summoner = await client.GetCurrentSummonerAsync(CancellationToken.None);
            if (summoner == null) {
                logger.Error("Could not get current summoner.");
                return;
            }

            logger.Info($"Collecting matches for: {summoner.DisplayName}");
            var matchHistory = await client.GetMatchHistoryAsync(summoner.Puuid, CancellationToken.None);
            
            if (matchHistory != null && matchHistory.Games.Items.Any())
            {
                foreach (var match in matchHistory.Games.Items.Take(matchLimit))
                {
                    if (match.QueueId == 2400) // Mayhem queue
                    {
                        logger.Info($"Fetching details for match {match.GameId}...");
                        var fullMatch = await client.TryGetMatchDetailsAsync(match.GameId, CancellationToken.None);
                        
                        if (fullMatch != null) {
                            logger.Info("MATCH_PAYLOAD_START");
                            logger.Info(JsonSerializer.Serialize(fullMatch, new JsonSerializerOptions { WriteIndented = true }));
                            logger.Info("MATCH_PAYLOAD_END");
                        }
                    }
                }
            }
            else
            {
                logger.Info("No matches found in history.");
            }
        }
        catch (Exception ex)
        {
            logger.Error("Fatal error during diagnostic collection.", ex);
        }

        logger.Info("Diagnostic collection complete. Please send 'diagnostic.log' to the developer.");
    }
}
