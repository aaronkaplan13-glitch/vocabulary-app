"use client";

import { useEffect, useState } from "react";
import { Masthead } from "@/components/Masthead";
import type { MorphemeType } from "@/lib/types";

interface GraphMorpheme {
  id: string;
  type: MorphemeType;
  text: string;
  meaning: string | null;
  words: { id: string; text: string }[];
}

const TYPE_COLOR: Record<MorphemeType, string> = {
  prefix: "var(--m-prefix)",
  root: "var(--m-root)",
  suffix: "var(--m-suffix)",
  infix: "var(--m-other)",
  combining: "var(--m-other)",
};

export default function GraphPage() {
  const [morphemes, setMorphemes] = useState<GraphMorpheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/morphemes", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load roots.");
        setMorphemes(data.morphemes);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const connected = morphemes.filter((m) => m.words.length > 1);

  return (
    <>
      <Masthead />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        <h1 className="font-display text-3xl text-ink">Roots & affixes</h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          The graph assembles itself as you add words. Shared roots reveal the
          family ties between them — learn one, and the others come cheaper.
        </p>

        {loading && <p className="mt-8 eyebrow">Tracing the roots…</p>}
        {error && <p className="mt-8 label-mono text-flag">{error}</p>}

        {!loading && !error && morphemes.length === 0 && (
          <p className="mt-10 font-display text-xl italic text-ink-soft">
            No morphemes yet — add a few words to grow the graph.
          </p>
        )}

        {connected.length > 0 && (
          <p className="eyebrow mt-10">Shared across multiple words</p>
        )}

        <ul className="mt-4 space-y-px bg-line">
          {morphemes.map((m) => (
            <li key={m.id} className="bg-paper-raised px-4 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="font-display text-2xl"
                  style={{ color: TYPE_COLOR[m.type] }}
                >
                  {m.text}
                </span>
                <span className="label-mono text-ink-faint">{m.type}</span>
                {m.meaning && (
                  <span className="font-display italic text-ink-soft">
                    “{m.meaning}”
                  </span>
                )}
                <span className="label-mono ml-auto text-ink-faint">
                  {m.words.length} {m.words.length === 1 ? "word" : "words"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {m.words.map((w) => (
                  <span
                    key={w.id}
                    className="border border-line-strong px-2 py-0.5 label-mono text-ink-soft"
                  >
                    {w.text}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
