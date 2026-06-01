using System.Diagnostics;
using System.Text.Json;

namespace GameFive.Companion;

internal static class LcuLockfile
{
    public static LcuConnection? TryRead(CompanionLogger logger)
    {
        // Retry logic: try 5 times, 2 seconds apart
        for (int i = 0; i < 5; i++)
        {
            foreach (var path in CandidatePaths(logger))
            {
                if (!File.Exists(path)) continue;

                try
                {
                    var content = ReadShared(path).Trim();
                    var parts = content.Split(':');
                    if (parts.Length < 5) continue;

                    if (!int.TryParse(parts[2], out var port)) continue;

                    logger.Info($"Successfully found and read lockfile at: {path}");
                    return new LcuConnection
                    {
                        Port = port,
                        AuthToken = parts[3],
                        Protocol = parts[4]
                    };
                }
                catch (Exception ex)
                {
                    logger.Error($"Failed to read lockfile at {path}.", ex);
                }
            }

            logger.Warn($"LCU lockfile not found (attempt {i + 1}/5). Retrying...");
            Thread.Sleep(2000);
        }

        logger.Error("Could not find LCU lockfile from RiotClientInstalls.json. Exiting.");
        Environment.Exit(1);
        return null;
    }

    private static IEnumerable<string> CandidatePaths(CompanionLogger logger)
    {
        var foundPaths = new List<string>();
        
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var installsFile = Path.Combine(programData, "Riot Games", "RiotClientInstalls.json");
        
        if (File.Exists(installsFile))
        {
            try
            {
                var json = File.ReadAllText(installsFile);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("associated_client", out var associatedClient))
                {
                    foreach (var path in associatedClient.EnumerateObject())
                    {
                        if (path.Name.Contains("League of Legends", StringComparison.OrdinalIgnoreCase))
                        {
                            var lockfilePath = Path.Combine(path.Name, "lockfile");
                            logger.Info($"Checking RiotClientInstalls path: {lockfilePath}");
                            foundPaths.Add(lockfilePath);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.Error($"Failed to parse RiotClientInstalls.json: {ex.Message}", ex);
            }
        }
        return foundPaths;
    }

    private static string ReadShared(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
