using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace GameFive.Companion;

internal static class MatchUploaderService
{
    public static async Task UploadRecentMatchesAsync(LcuConnection connection, GameFiveUploader uploader, int matchLimit, CompanionLogger logger)
    {
        logger.Info($"Starting manual match upload (Limit: {matchLimit})...");
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
                            var upload = MatchMapper.ToUpload(fullMatch, summoner.Puuid);
                            await uploader.UploadOrQueueAsync(upload, CancellationToken.None);
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
            logger.Error("Fatal error during match upload.", ex);
        }

        logger.Info("Match upload complete.");
    }
}
