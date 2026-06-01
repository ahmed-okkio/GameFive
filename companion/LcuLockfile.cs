using System.Diagnostics;
using Microsoft.Win32;
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

        logger.Warn("Could not find LCU lockfile from RiotClientInstalls.json or common paths.");
        return null;
    }

    private static IEnumerable<string> CandidatePaths(CompanionLogger logger)
    {
        var foundPaths = new List<string>();

        // 1. Primary: RiotClientInstalls.json
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

        // 2. Fallback: Check Registry
        try {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Riot Games, Inc\League of Legends");
            var path = key?.GetValue("Location") as string;
            if (!string.IsNullOrEmpty(path)) {
                var lockfilePath = Path.Combine(path, "lockfile");
                logger.Info($"Checking registry path lockfile: {lockfilePath}");
                foundPaths.Add(lockfilePath);
            }
        } catch {}

        // 3. Fallback: Common paths
        var commonRoots = new[]
        {
            @"C:\Riot Games\League of Legends",
            @"C:\Program Files\Riot Games\League of Legends",
            @"C:\Program Files (x86)\Riot Games\League of Legends"
        };

        foreach (var root in commonRoots)
        {
            var lockfilePath = Path.Combine(root, "lockfile");
            logger.Info($"Checking common root lockfile: {lockfilePath}");
            foundPaths.Add(lockfilePath);
        }

        // 4. Last resort: running process
        var processes = Process.GetProcessesByName("LeagueClient");
        foreach (var process in processes)
        {
            try
            {
                var path = Path.GetDirectoryName(process.MainModule?.FileName);
                if (!string.IsNullOrEmpty(path))
                {
                    var lockfilePath = Path.Combine(path, "lockfile");
                    logger.Info($"Checking process directory lockfile: {lockfilePath}");
                    foundPaths.Add(lockfilePath);
                }
            }
            catch (Exception ex)
            {
                logger.Warn($"Could not access path for LeagueClient process (PID {process.Id}): Access denied.");
            }
        }

        return foundPaths.Distinct();
    }

    private static string ReadShared(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
