using System.Text.Json;

namespace GameFive.Companion;

internal sealed class UploadQueue
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    // shortcut: oldest games are dropped past this; a Mayhem Week is a few dozen games per player.
    public const int MaxQueued = 100;

    private readonly string _path;
    private readonly CompanionLogger _logger;
    // Enqueue and Remove are read-modify-write; a concurrent pair must not overwrite each other.
    private readonly object _lock = new();

    public UploadQueue(string path, CompanionLogger logger)
    {
        _path = path;
        _logger = logger;
    }

    public List<CompanionMatchUpload> Load()
    {
        if (!File.Exists(_path))
        {
            return [];
        }

        // IO errors propagate: answering "empty" would let the next Save wipe the real queue.
        var json = File.ReadAllText(_path);
        try
        {
            return JsonSerializer.Deserialize<List<CompanionMatchUpload>>(json) ?? [];
        }
        catch (JsonException ex)
        {
            // Keep the unreadable file for inspection instead of overwriting it on the next Save.
            var bad = $"{_path}.{DateTime.UtcNow:yyyyMMddHHmmss}.bad";
            File.Move(_path, bad, overwrite: true);
            _logger.Error($"Upload queue was unreadable; moved aside to {bad}.", ex);
            return [];
        }
    }

    public void Save(List<CompanionMatchUpload> uploads)
    {
        var distinct = uploads
            .GroupBy(upload => upload.GameId)
            .Select(group => group.First())
            .OrderByDescending(upload => upload.GameCreation)
            .Take(MaxQueued)
            .ToList();

        // Write then rename, so a crash mid-write never leaves a half-written queue.
        var tmp = _path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(distinct, JsonOptions));
        File.Move(tmp, _path, overwrite: true);
    }

    public void Enqueue(CompanionMatchUpload upload)
    {
        lock (_lock)
        {
            var uploads = Load();

            if (uploads.All(item => item.GameId != upload.GameId))
            {
                uploads.Add(upload);
                Save(uploads);
            }
        }
    }

    public void Remove(IReadOnlyCollection<long> gameIds)
    {
        if (gameIds.Count == 0) return;
        lock (_lock)
        {
            Save(Load().Where(upload => !gameIds.Contains(upload.GameId)).ToList());
        }
    }
}
