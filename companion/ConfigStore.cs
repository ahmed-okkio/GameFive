using System.Text.Json;

namespace GameFive.Companion;

internal sealed class ConfigStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    private readonly string _path;
    private readonly CompanionLogger _logger;

    public ConfigStore(string path, CompanionLogger logger)
    {
        _path = path;
        _logger = logger;
    }

    public CompanionConfig? Load()
    {
        if (!File.Exists(_path))
        {
            return null;
        }

        try
        {
            var json = File.ReadAllText(_path);
            return JsonSerializer.Deserialize<CompanionConfig>(json);
        }
        catch (Exception ex)
        {
            _logger.Error("Failed to load config.", ex);
            return null;
        }
    }

    public void Save(CompanionConfig config)
    {
        var json = JsonSerializer.Serialize(config, JsonOptions);
        File.WriteAllText(_path, json);
    }

    public void CreateTemplate()
    {
        Save(new CompanionConfig());
    }
}
