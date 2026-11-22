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

        try
        {
            var json = File.ReadAllText(_path);
            return JsonSerializer.Deserialize<List<CompanionMatchUpload>>(json) ?? [];
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to load failed upload queue.", ex);
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

        File.WriteAllText(_path, JsonSerializer.Serialize(distinct, JsonOptions));
    }

    public void Enqueue(CompanionMatchUpload upload)
    {
        var uploads = Load();

        if (uploads.All(item => item.GameId != upload.GameId))
        {
            uploads.Add(upload);
            Save(uploads);
        }
    }
}
