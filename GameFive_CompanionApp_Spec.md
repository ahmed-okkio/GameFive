# GameFive Companion App — Technical Implementation Spec

## Context

You have already received the GameFive technical specification (GameFive_Specification.md), the companion app architecture update (GameFive_SpecUpdate_Prompt.md), and the ranked system redesign (GameFive_RankedSystem_Update.md). This prompt defines exactly how the companion app under `/companion` should be built. It supersedes the companion app tech stack section of GameFive_SpecUpdate_Prompt.md.

---

## Goal

Build the lightest possible Windows background app that silently captures ARAM Mayhem game results via the League Client Update (LCU) API and uploads them to the GameFive server. It must be non-intrusive, use minimal system resources, and produce a single small executable requiring no installer.

---

## Language & Runtime

**C# .NET 6+ Worker Service** — not Windows Forms, not WPF, not a console app. A Worker Service is a pure background host with no UI framework loaded, giving the smallest possible memory footprint for a .NET app.

**Publish configuration — framework-dependent single file:**
```
dotnet publish -r win-x64 -c Release --self-contained false /p:PublishSingleFile=true
```

This produces a single ~1MB `.exe`. It relies on the .NET 6+ runtime being pre-installed on the user's machine, which it will be on any modern Windows 10/11 system. Do not publish self-contained — that bloats the exe to 60MB+ unnecessarily.

**Output:** One `.exe` file. No installer. No dependencies to distribute. Friends download and run it directly.

---

## Resource Targets

- Exe size on disk: ~1MB
- RAM at idle (League closed): ~25MB
- CPU when idle: 0%
- CPU when League is open between games: negligible
- CPU spike: only when a game ends and one HTTP POST is fired

---

## Architecture

### No polling — use WMI event watching
Do not poll `Process.GetProcessesByName` on a timer. Instead use `ManagementEventWatcher` (WMI) to subscribe to a Windows process creation event for `LeagueClient.exe`. This is fully event-driven — zero CPU usage while waiting, fires instantly the moment League opens. Example:

```csharp
var query = new WqlEventQuery(
    "SELECT * FROM Win32_ProcessStartTrace WHERE ProcessName = 'LeagueClient.exe'"
);
var watcher = new ManagementEventWatcher(query);
watcher.EventArrived += OnLeagueClientStarted;
watcher.Start();
```

Similarly subscribe to `Win32_ProcessStopTrace` to detect when League closes.

### HttpClient
Use a single static or singleton `HttpClient` instance for all outbound HTTP calls — both LCU calls and GameFive server uploads. Never instantiate `HttpClient` per request.

### LCU Connection
When League client is detected as running:
1. Read the lockfile to get the LCU port and auth token. The lockfile is located in the League of Legends install directory, typically:
   - `C:\Riot Games\League of Legends\lockfile`
   - Poll the filesystem briefly if the lockfile isn't present immediately after process start — the client may still be initialising. Retry every 2 seconds for up to 30 seconds before giving up.
2. The lockfile contains five colon-separated fields: `processName:pid:port:authToken:protocol`
3. Configure `HttpClient` for LCU calls:
   - `BaseAddress`: `https://127.0.0.1:{port}`
   - `Authorization` header: `Basic {Base64("riot:{authToken}")}`
   - Disable SSL certificate validation — the LCU uses a self-signed certificate

### WebSocket — End of Game Event
Connect to the LCU WebSocket at `wss://127.0.0.1:{port}` using `System.Net.WebSockets.ClientWebSocket` — no external WebSocket library needed.

Subscribe to the LCU event that fires when a game ends and the post-game screen appears. The relevant subscription message is:
```json
[5, "OnJsonApiEvent_lol-end-of-game_v1_eog-stats-block"]
```

When this event fires, read the most recent match from the LCU:
```
GET /lol/match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=1
```

### Match Filtering
Only process games where the queue ID is 1900 (ARAM Mayhem) or gameMode is "CHERRY". Verify which field correctly identifies Mayhem in the actual LCU response and use whichever is reliable. Silently discard all other game modes — no logging, no action.

### Data Captured Per Game
From the LCU match response, extract and upload:
- matchId
- gameDate
- durationSeconds
- queueId
- For all 10 participants:
  - puuid
  - summonerName
  - championId
  - team (100 or 200)
  - win (boolean)
  - kills, deaths, assists
  - damageDealtToChampions
  - healingDone
  - teamTotalKills (for the participant's team)
  - teamTotalDamage (for the participant's team)

### Upload to GameFive Server
POST the captured match as JSON to:
```
POST https://{gamefive_server}/api/ingest/match
Authorization: Bearer {playerAuthToken}
Content-Type: application/json
```

On success (200 OK): done, no further action.

On failure (network error, server unreachable, non-200 response): serialise the match payload to the local retry queue (see below) and retry on next app launch.

### Local Retry Queue
A single JSON file at `%APPDATA%\GameFive\queue.json`. On startup, read this file and attempt to upload any queued matches before doing anything else. On successful upload, remove the match from the queue file. Keep the queue file compact — store only the raw match JSON payloads as an array.

### Config File
On first run, if no config exists, prompt the user with a minimal Windows dialog (use `System.Windows.Forms.InputBox` equivalent or a simple WinForms dialog — this is the only place WinForms is used, just for this one-time setup screen) to enter:
- Their Riot ID (gameName#tagLine)
- Their GameFive auth token (provided to them by the site)

Store these in `%APPDATA%\GameFive\config.json`:
```json
{
  "riotId": "PlayerName#EUW",
  "authToken": "abc123..."
}
```

If config exists on subsequent launches, skip straight to background operation with no UI shown.

---

## System Tray Icon

Use P/Invoke to call the Win32 `Shell_NotifyIcon` API directly — do not load Windows Forms or WPF just for the tray icon. This keeps the dependency footprint minimal.

Two icon states:
- **Grey** — League client is not running, companion is idle
- **Green** — League client is running and companion is connected and recording

Right-click context menu on tray icon with two options only:
- "Open GameFive" — opens the GameFive website in the default browser
- "Exit" — closes the companion app

No other UI, no window, no settings screen beyond the first-run setup dialog.

---

## Startup Registration

On first run (after config is saved), register the companion as a Windows startup process via the registry:

```csharp
Registry.CurrentUser.OpenSubKey(
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", true
).SetValue("GameFive", exePath);
```

This ensures it launches automatically when the PC boots. No admin privileges required — `HKEY_CURRENT_USER` is user-level.

---

## Logging

Minimal logging only. Write to a single rolling log file at `%APPDATA%\GameFive\log.txt`. Log only:
- App start
- League client detected / disconnected
- Match captured and uploaded successfully
- Match upload failed (with reason) and queued for retry
- Retry queue processed on startup

Do not log LCU polling, heartbeat events, or any non-Mayhem game activity. Keep the log file capped at 1MB — truncate oldest entries when exceeded.

---

## What NOT to include

- No auto-updater
- No telemetry or analytics
- No crash reporting service
- No settings UI beyond first-run config
- No WPF or Windows Forms beyond the one-time first-run dialog
- No external NuGet packages beyond `System.Management` (for WMI) which ships with .NET
- No SQLite or any database — the retry queue is a flat JSON file only

---

## Project Structure

```
/companion
  GameFive.Companion.csproj
  Program.cs               -- Worker Service host setup and startup registration
  LcuService.cs            -- LCU connection, lockfile reading, WebSocket subscription
  MatchIngester.cs         -- Match filtering, data extraction, upload logic
  RetryQueue.cs            -- Local JSON queue read/write
  TrayIcon.cs              -- Win32 Shell_NotifyIcon P/Invoke wrapper
  ConfigManager.cs         -- Config file read/write and first-run dialog
  appsettings.json         -- GameFive server URL
```

---

## Summary

Build a C# .NET 6+ Worker Service that:
1. Registers itself as a Windows startup process on first run
2. Shows a grey/green system tray icon via raw Win32 P/Invoke
3. Uses WMI event watching (not polling) to detect when League opens and closes
4. Connects to the LCU via lockfile, disables SSL validation, subscribes to end-of-game WebSocket event
5. On Mayhem game completion, captures full match data and POSTs to GameFive server
6. On upload failure, queues locally to `%APPDATA%\GameFive\queue.json` and retries on next launch
7. Produces a single ~1MB framework-dependent exe via `dotnet publish --self-contained false /p:PublishSingleFile=true`
8. Has zero CPU usage when League is not running and negligible impact when it is
EOF