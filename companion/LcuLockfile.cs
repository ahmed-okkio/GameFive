using System.Diagnostics;
using System.Text.Json;

namespace GameFive.Companion;

internal static class LcuLockfile
{
    public static LcuConnection? TryRead(CompanionLogger logger)
    {
        var path = GetPathFromInstalls(logger);
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
        {
            logger.Warn("LCU lockfile not found in RiotClientInstalls.json. Retrying later...");
            return null;
        }

        try
        {
            var content = ReadShared(path).Trim();
            var parts = content.Split(':');
            if (parts.Length < 5) return null;

            if (!int.TryParse(parts[2], out var port)) return null;

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
            return null;
        }
    }

    private static string? GetPathFromInstalls(CompanionLogger logger)
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var installsFile = Path.Combine(programData, "Riot Games", "RiotClientInstalls.json");
        
        if (!File.Exists(installsFile))
        {
            logger.Error($"RiotClientInstalls.json not found at {installsFile}");
            return null;
        }

        try
        {
            var json = File.ReadAllText(installsFile);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("associated_client", out var associatedClient))
            {
                foreach (var path in associatedClient.EnumerateObject())
                {
                    var lockfilePath = Path.Combine(path.Name, "lockfile");
                    logger.Info($"Checking RiotClientInstalls path: {lockfilePath}");
                    return lockfilePath;
                }
            }
        }
        catch (Exception ex)
        {
            logger.Error($"Failed to parse RiotClientInstalls.json: {ex.Message}", ex);
        }

        return null;
    }

    private static string ReadShared(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
