import { SearchForm } from "@/components/SearchForm";
import { appConfig } from "@/lib/config";

export default function HomePage() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-145px)] max-w-6xl content-center px-4 py-16">
      <div className="max-w-3xl">
        <p className="mb-3 inline-flex rounded border border-gold/40 px-3 py-1 text-sm font-semibold text-gold">EUW only</p>
        <h1 className="text-5xl font-black leading-tight text-white sm:text-7xl">GameFive</h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-300">
          Private unofficial ARAM Mayhem MMR tracker for League of Legends.
        </p>
        <div className="mt-8">
          <SearchForm />
          {appConfig.companionDownloadUrl && (
            <p className="mt-4 text-sm text-stone-400">
              Mayhem games are only recorded if you run the{" "}
              <a href={appConfig.companionDownloadUrl} className="font-semibold text-gold hover:underline">
                GameFive Companion app
              </a>{" "}
              while you play.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
