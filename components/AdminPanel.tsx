"use client";

import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Settings = { retire: boolean; ceremonyUrl: string | null; minVersion: string | null; maintenance: boolean };

type AdminPanelProps = {
  entrants: Array<{ id: string; riotIdName: string; riotIdTag: string }>;
  matches: Array<{ id: string; matchId: string; gameDate: string; players: string[] }>;
  settings: Settings;
};

const box = "mt-6 rounded border border-line bg-black/20 p-4";
const input = "rounded border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-gold";

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", { username, password, redirect: false });
    if (result?.error) setError("Invalid username or password");
    else router.refresh();
  }

  return (
    <form onSubmit={login} className="max-w-sm rounded border border-line bg-panel p-5">
      <h1 className="text-2xl font-black text-white">Admin</h1>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" className={`mt-3 w-full ${input}`} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" className={`mt-3 w-full ${input}`} />
      <button className="mt-4 rounded bg-gold px-4 py-2 font-bold text-black">Sign in</button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </form>
  );
}

export function AdminPanel({ entrants, matches, settings }: AdminPanelProps) {
  const router = useRouter();
  const [retire, setRetire] = useState(settings.retire);
  const [ceremonyUrl, setCeremonyUrl] = useState(settings.ceremonyUrl ?? "");
  const [minVersion, setMinVersion] = useState(settings.minVersion ?? "");
  const [message, setMessage] = useState("");

  async function call(url: string, init: RequestInit, done: string) {
    const response = await fetch(url, init);
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? done : json.error ?? `Failed (${response.status})`);
    router.refresh();
  }

  function removeEntrant(id: string, name: string) {
    if (confirm(`Remove Entrant ${name}? Their games stay as history.`)) {
      call(`/api/admin/entrants?id=${encodeURIComponent(id)}`, { method: "DELETE" }, `Removed ${name}`);
    }
  }

  function deleteMatch(id: string, matchId: string) {
    if (confirm(`Delete match ${matchId} and all its participants?`)) {
      call(`/api/admin/matches?id=${encodeURIComponent(id)}`, { method: "DELETE" }, `Deleted match ${matchId}`);
    }
  }

  function setMaintenance(on: boolean) {
    const body = JSON.stringify({ maintenance: on });
    call("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body }, `Maintenance pause ${on ? "on" : "off"}`);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    call(
      "/api/admin/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retire, ceremonyUrl: ceremonyUrl.trim() || null, minVersion: minVersion.trim() || null })
      },
      "Settings saved"
    );
  }

  return (
    <div className="rounded border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Admin</h1>
        <button onClick={() => signOut({ callbackUrl: "/admin" })} className="rounded border border-line px-3 py-2 text-sm">
          Sign out
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-gold">{message}</p>}

      <div className={box}>
        <h2 className="font-bold text-white">Maintenance pause</h2>
        <p className="mt-1 text-sm">
          Currently <strong>{settings.maintenance ? "ON" : "OFF"}</strong>. While on, game uploads get 503 and store nothing, and the site shows a notice.
        </p>
        <button onClick={() => setMaintenance(!settings.maintenance)} className="mt-3 rounded bg-gold px-3 py-2 text-sm font-bold text-black">
          Turn {settings.maintenance ? "off" : "on"}
        </button>
      </div>

      <form onSubmit={saveSettings} className={box}>
        <h2 className="font-bold text-white">Companion</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={retire} onChange={(e) => setRetire(e.target.checked)} />
          Retire the Companion
        </label>
        <input value={ceremonyUrl} onChange={(e) => setCeremonyUrl(e.target.value)} placeholder="Ceremony URL (optional)" className={`mt-3 w-full ${input}`} />
        <input value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="Minimum Companion version (optional)" className={`mt-3 w-full ${input}`} />
        <button className="mt-3 rounded bg-gold px-3 py-2 text-sm font-bold text-black">Save</button>
      </form>

      <div className={box}>
        <h2 className="font-bold text-white">Entrants ({entrants.length})</h2>
        <div className="mt-3 space-y-2">
          {entrants.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded border border-line p-2 text-sm">
              <span>
                {e.riotIdName}#{e.riotIdTag}
              </span>
              <button onClick={() => removeEntrant(e.id, `${e.riotIdName}#${e.riotIdTag}`)} className="text-ember">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={box}>
        <h2 className="font-bold text-white">Latest matches</h2>
        <div className="mt-3 space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded border border-line p-2 text-sm">
              <span className="min-w-0">
                <span className="font-mono">{m.matchId}</span> · {new Date(m.gameDate).toLocaleString()}
                <span className="block truncate text-xs text-stone-400">{m.players.join(", ")}</span>
              </span>
              <button onClick={() => deleteMatch(m.id, m.matchId)} className="shrink-0 text-ember">
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
