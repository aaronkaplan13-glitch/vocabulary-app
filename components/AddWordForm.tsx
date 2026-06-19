"use client";

import { useState } from "react";
import { MorphemeGloss } from "./MorphemeGloss";
import type { WordWithMorphemes } from "@/lib/types";

/**
 * Add a word: the learner types it, Claude returns the definition + morpheme
 * breakdown, and the result previews as a gloss before being saved.
 */
export function AddWordForm({ onAdded }: { onAdded?: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<WordWithMorphemes | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const word = text.trim();
    if (!word || busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add the word.");
      setAdded(data.word);
      setText("");
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-stretch gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a word…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 border-b border-line-strong bg-transparent px-1 py-2 font-display text-2xl text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="self-end border border-ink bg-ink px-4 py-2 label-mono text-paper transition-colors hover:bg-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Reading…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="mt-3 label-mono text-flag" role="alert">
          {error}
        </p>
      )}

      {added && (
        <div className="mt-6 animate-rise border-l-2 border-accent bg-paper-raised/60 py-3 pl-4">
          <MorphemeGloss
            word={added.text}
            morphemes={added.morphemes}
            size="3xl"
            showGloss
          />
          <p className="mt-3 font-display italic text-ink-soft">
            {added.definition}
          </p>
          <p className="eyebrow mt-2">Added to your deck · stage 0 · Encounter</p>
        </div>
      )}
    </div>
  );
}
