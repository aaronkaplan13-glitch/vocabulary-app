"use client";

import { useCallback, useEffect, useState } from "react";
import { Masthead } from "@/components/Masthead";
import { MorphemeGloss } from "@/components/MorphemeGloss";
import { StageLadder } from "@/components/StageLadder";
import type { WordWithMorphemes } from "@/lib/types";

function dueLabel(due: string, introduced: string | null): string {
  if (!introduced) return "new";
  const ms = new Date(due).getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "due now";
  if (days === 1) return "due tomorrow";
  if (days < 30) return `due in ${days}d`;
  return `due in ${Math.round(days / 30)}mo`;
}

export default function DeckPage() {
  const [words, setWords] = useState<WordWithMorphemes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/words", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the deck.");
      setWords(data.words);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Remove this word from your deck?")) return;
    await fetch(`/api/words/${id}`, { method: "DELETE" });
    setWords((w) => w.filter((x) => x.id !== id));
  }

  return (
    <>
      <Masthead />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl text-ink">The deck</h1>
          <span className="label-mono text-ink-faint">
            {words.length} words
          </span>
        </div>

        {loading && <p className="mt-8 eyebrow">Opening the deck…</p>}
        {error && <p className="mt-8 label-mono text-flag">{error}</p>}

        {!loading && !error && words.length === 0 && (
          <p className="mt-10 max-w-prose font-display text-xl italic text-ink-soft">
            No words yet. Add your first one from the Today page and it’ll begin
            its journey at Encounter.
          </p>
        )}

        <ul className="mt-8 divide-y divide-line border-y border-line">
          {words.map((w) => (
            <li key={w.id} className="group flex gap-4 py-6">
              <div className="min-w-0 flex-1">
                <MorphemeGloss
                  word={w.text}
                  morphemes={w.morphemes}
                  size="3xl"
                />
                <p className="mt-3 font-display italic text-ink-soft">
                  {w.definition}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <StageLadder stage={w.current_stage} />
                  <span className="label-mono text-ink-faint">
                    {dueLabel(w.due, w.introduced_on)}
                  </span>
                  {w.reps > 0 && (
                    <span className="label-mono text-ink-faint">
                      {w.reps} reviews
                      {w.lapses > 0 ? ` · ${w.lapses} lapses` : ""}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(w.id)}
                aria-label={`Remove ${w.text}`}
                className="self-start opacity-0 transition-opacity label-mono text-ink-faint hover:text-flag group-hover:opacity-100"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
