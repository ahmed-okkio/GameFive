using System.Net;
using GameFive.Companion;

namespace GameFive.Companion.Tests;

public class UploadQueueTests : IDisposable
{
    private readonly string _dir = Directory.CreateTempSubdirectory("gf-queue-").FullName;

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    private sealed class FakeServer(Func<HttpResponseMessage> respond) : HttpMessageHandler
    {
        public Func<HttpResponseMessage> Respond { get; set; } = respond;
        public List<long> Sent { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = await request.Content!.ReadAsStringAsync(ct);
            Sent.Add(System.Text.Json.JsonDocument.Parse(body).RootElement.GetProperty("gameId").GetInt64());
            return Respond();
        }
    }

    private static HttpResponseMessage Answer(HttpStatusCode code) => new(code) { Content = new StringContent("{}") };

    private (GameFiveUploader uploader, UploadQueue queue) Create(FakeServer server)
    {
        var logger = new CompanionLogger(Path.Combine(_dir, "log.txt"));
        var queue = new UploadQueue(Path.Combine(_dir, "queue.json"), logger);
        return (new GameFiveUploader(queue, logger, server), queue);
    }

    private static CompanionMatchUpload Game(long id) => new() { GameId = id, GameCreation = id };

    [Theory]
    [InlineData(200, true)]
    [InlineData(201, true)]
    [InlineData(400, true)]
    [InlineData(401, false)]
    [InlineData(403, false)]
    [InlineData(404, false)]
    [InlineData(429, false)]
    [InlineData(500, false)]
    [InlineData(503, false)]
    public void OnlyFinalAnswersLeaveTheQueue(int status, bool final) =>
        Assert.Equal(final, CompanionRules.IsFinalUploadAnswer(status));

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.Unauthorized)]
    public async Task FailedUploadSurvivesLaterFlushesAndGoesThroughOnceTheServerAnswers(HttpStatusCode failure)
    {
        var server = new FakeServer(() => Answer(failure));
        var (uploader, queue) = Create(server);

        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);
        Assert.Single(queue.Load());

        uploader.ResetCooldown();
        await uploader.FlushAsync(CancellationToken.None); // still failing: must stay queued
        Assert.Single(queue.Load());

        server.Respond = () => Answer(HttpStatusCode.OK);
        uploader.ResetCooldown();
        await uploader.FlushAsync(CancellationToken.None);
        Assert.Empty(queue.Load());
        Assert.Equal([1L, 1L, 1L], server.Sent);
    }

    [Fact]
    public async Task NetworkErrorKeepsTheGameQueued()
    {
        var server = new FakeServer(() => throw new HttpRequestException("down"));
        var (uploader, queue) = Create(server);

        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);
        uploader.ResetCooldown();
        await uploader.FlushAsync(CancellationToken.None);

        Assert.Single(queue.Load());
    }

    [Fact]
    public async Task BadRequestIsDroppedAndNeverResent()
    {
        var server = new FakeServer(() => Answer(HttpStatusCode.BadRequest));
        var (uploader, queue) = Create(server);

        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);
        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);

        Assert.Empty(queue.Load());
        Assert.Equal([1L], server.Sent);
    }

    [Fact]
    public async Task AcceptedGameIsNotUploadedAgain()
    {
        var server = new FakeServer(() => Answer(HttpStatusCode.OK));
        var (uploader, _) = Create(server);

        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);
        await uploader.UploadOrQueueAsync(Game(1), CancellationToken.None);

        Assert.Equal([1L], server.Sent);
    }

    [Fact]
    public async Task ConcurrentUploadsOfOneGameSendItOnce()
    {
        var server = new FakeServer(() => Answer(HttpStatusCode.OK));
        var (uploader, _) = Create(server);

        await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => uploader.UploadOrQueueAsync(Game(1), CancellationToken.None)));

        Assert.Equal([1L], server.Sent);
    }

    [Fact]
    public void QueueKeepsTheNewestGamesUpToTheCap()
    {
        var (_, queue) = Create(new FakeServer(() => Answer(HttpStatusCode.OK)));
        queue.Save(Enumerable.Range(1, UploadQueue.MaxQueued + 5).Select(i => Game(i)).ToList());

        var kept = queue.Load();
        Assert.Equal(UploadQueue.MaxQueued, kept.Count);
        Assert.DoesNotContain(kept, g => g.GameId <= 5);
    }

    [Fact]
    public async Task GameIsOnDiskBeforeItIsSent()
    {
        UploadQueue? queue = null;
        var onDiskAtSend = new List<long>();
        var server = new FakeServer(() =>
        {
            onDiskAtSend.AddRange(queue!.Load().Select(g => g.GameId));
            return Answer(HttpStatusCode.OK);
        });
        (var uploader, queue) = Create(server);

        await uploader.UploadOrQueueAsync(Game(7), CancellationToken.None);

        Assert.Equal([7L], onDiskAtSend);
        Assert.Empty(queue.Load());
    }

    [Fact]
    public async Task CancelledWhileWaitingStillLeavesTheGameQueued()
    {
        var (uploader, queue) = Create(new FakeServer(() => Answer(HttpStatusCode.OK)));
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => uploader.UploadOrQueueAsync(Game(3), cancelled.Token));

        Assert.Equal(3L, Assert.Single(queue.Load()).GameId);
    }

    [Fact]
    public void CorruptQueueFileIsKeptAsideNotWiped()
    {
        var (_, queue) = Create(new FakeServer(() => Answer(HttpStatusCode.OK)));
        var path = Path.Combine(_dir, "queue.json");
        File.WriteAllText(path, "[{\"gameId\": 1, trunc");

        Assert.Empty(queue.Load());
        queue.Enqueue(Game(2));

        var bad = Assert.Single(Directory.GetFiles(_dir, "queue.json.*.bad"));
        Assert.Equal("[{\"gameId\": 1, trunc", File.ReadAllText(bad));
        Assert.Equal(2L, Assert.Single(queue.Load()).GameId);
    }

    [Fact]
    public void SaveLeavesNoTempFileBehind()
    {
        var (_, queue) = Create(new FakeServer(() => Answer(HttpStatusCode.OK)));
        queue.Save([Game(1)]);
        Assert.Equal(["queue.json"], Directory.GetFiles(_dir, "queue.json*").Select(Path.GetFileName));
    }
}
