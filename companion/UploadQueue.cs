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
    // Every file access holds this, so no rename lands while another call reads or writes the file.
    private readonly object _lock = new();

    public UploadQueue(string path, CompanionLogger logger)
    {
        _path = path;
        _logger = logger;
    }

    // Windows reports a locked file as IOException or UnauthorizedAccessException; both are transient here.
    public static bool IsFileError(Exception ex) => ex is IOException or UnauthorizedAccessException;

    // File errors propagate: answering "empty" would let the next Save wipe the real queue.
    public List<CompanionMatchUpload> Load()
    {
        lock (_lock)
        {
            if (!File.Exists(_path))
            {
                return [];
            }

            var json = WithRetry(() => File.ReadAllText(_path));
            try
            {
                return JsonSerializer.Deserialize<List<CompanionMatchUpload>>(json) ?? [];
            }
            catch (JsonException ex)
            {
                // Keep the unreadable file for inspection instead of overwriting it on the next Save.
                var bad = $"{_path}.{DateTime.UtcNow:yyyyMMddHHmmss}.bad";
                WithRetry(() => File.Move(_path, bad, overwrite: true));
                _logger.Error($"Upload queue was unreadable; moved aside to {bad}.", ex);
                return [];
            }
        }
    }

    public void Save(List<CompanionMatchUpload> uploads)
    {
        lock (_lock)
        {
            var distinct = uploads
                .GroupBy(upload => upload.GameId)
                .Select(group => group.First())
                .OrderByDescending(upload => upload.GameCreation)
                .Take(MaxQueued)
                .ToList();

            // Write through to disk, then rename: neither a crash nor power loss leaves a half-written queue.
            var tmp = _path + ".tmp";
            using (var stream = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                JsonSerializer.Serialize(stream, distinct, JsonOptions);
                stream.Flush(flushToDisk: true);
            }
            WithRetry(() => File.Move(tmp, _path, overwrite: true));
        }
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

    // Antivirus, indexers and backups hold files briefly; a few short retries ride that out.
    private static T WithRetry<T>(Func<T> action)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return action();
            }
            catch (Exception ex) when (IsFileError(ex) && attempt < 5)
            {
                Thread.Sleep(100);
            }
        }
    }

    private static void WithRetry(Action action) => WithRetry(() => { action(); return 0; });
}
