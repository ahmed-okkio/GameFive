"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

type AdminData = {
  entries: Array<{
    id: string;
    player: {
      riotIdName: string;
      riotIdTag: string;
    };
  }>;
};

export function AdminPanel() {
  const { data: session, status } = useSession();
  const [password, setPassword] = useState("");
  const [riotId, setRiotId] = useState("");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAdminData() {
    const response = await fetch("/api/admin/leaderboard", {
      cache: "no-store"
    });

    if (response.ok) {
      setAdminData((await response.json()) as AdminData);
    }
  }

  useEffect(() => {
    if (session) {
      loadAdminData();
    }
  }, [session]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      username: "admin",
      password,
      redirect: false
    });

    if (result?.error) {
      setError("Invalid password");
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/leaderboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        riotId
      })
    });
    const json = (await response.json()) as { error?: string };

    setMessage(json.error ?? "Player added");
    setRiotId("");
    await loadAdminData();
  }

  async function removeEntry(id: string) {
    await fetch(`/api/admin/leaderboard?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    await loadAdminData();
  }

  if (status === "loading") {
    return <p className="text-stone-400">Loading...</p>;
  }

  if (!session) {
    return (
      <form onSubmit={login} className="max-w-sm rounded border border-line bg-panel p-5">
        <h1 className="text-2xl font-black text-white">Admin</h1>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          className="mt-3 w-full rounded border border-line bg-black/30 px-3 py-2 outline-none focus:border-gold"
        />
        <button className="mt-4 rounded bg-gold px-4 py-2 font-bold text-black">Sign in</button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div className="rounded border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Admin</h1>
          <p className="text-sm text-stone-400">Signed in as {session.user?.name}</p>
        </div>
        <button onClick={() => signOut()} className="rounded border border-line px-3 py-2 text-sm">
          Sign out
        </button>
      </div>
      <div className="mt-6">
        <div className="rounded border border-line bg-black/20 p-4">
          <h2 className="font-bold text-white">Leaderboard</h2>
          <form onSubmit={addPlayer} className="mt-3 flex gap-2">
            <input
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
              placeholder="PlayerName#EUW"
              className="min-w-0 flex-1 rounded border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <button className="rounded bg-gold px-3 py-2 text-sm font-bold text-black">Add</button>
          </form>
          {message ? <p className="mt-2 text-sm text-gold">{message}</p> : null}
          <div className="mt-4 space-y-2">
            {adminData?.entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded border border-line p-2 text-sm">
                <span>
                  {entry.player.riotIdName}#{entry.player.riotIdTag}
                </span>
                <button onClick={() => removeEntry(entry.id)} className="text-ember">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
