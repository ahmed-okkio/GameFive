"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SearchFormProps = {
  compact?: boolean;
};

export function SearchForm({ compact = false }: SearchFormProps) {
  const router = useRouter();
  const [riotId, setRiotId] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [gameName, tagLine] = riotId.split("#");

    if (!gameName?.trim() || !tagLine?.trim()) {
      setError("Use Riot ID format: PlayerName#EUW");
      return;
    }

    router.push(`/player/${encodeURIComponent(gameName.trim())}/${encodeURIComponent(tagLine.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} className={`flex w-full flex-col gap-3 sm:flex-row ${compact ? "text-sm" : ""}`}>
      <div className="flex-1">
        <input
          value={riotId}
          onChange={(event) => {
            setRiotId(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
                onSubmit(event as unknown as FormEvent<HTMLFormElement>);
            }
          }}
          placeholder="Enter Riot ID (e.g. PlayerName#EUW)"
          className={`${compact ? "py-2.5" : "py-3"} w-full rounded border border-line bg-black/30 px-4 text-stone-100 outline-none ring-gold/30 placeholder:text-stone-500 focus:ring-2`}
        />
        {error ? <p className="mt-2 text-sm text-ember">{error}</p> : null}
      </div>
      <button className={`${compact ? "py-2.5" : "min-w-[140px] py-3"} interactive inline-flex items-center justify-center gap-2 rounded border border-sky-400/35 bg-sky-500/15 px-5 font-bold text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-sky-300/50 hover:bg-sky-400/20 hover:text-white`}>
        <Search size={18} />
        Search
      </button>
    </form>
  );
}
