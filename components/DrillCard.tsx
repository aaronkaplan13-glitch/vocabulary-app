"use client";

import { useMemo, useState } from "react";
import { Rating, type Grade } from "ts-fsrs";
import { MorphemeGloss } from "./MorphemeGloss";
import { StageLadder } from "./StageLadder";
import { RatingButtons } from "./RatingButtons";
import { STAGE, STAGE_PROMPTS } from "@/lib/stages";
import type { DrillCard as DrillCardType } from "@/lib/types";

/** Blank out the target word in its example sentence for cued recall. */
function blankExample(example: string | null, word: string): string | null {
  if (!example) return null;
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "gi");
  return re.test(example) ? example.replace(re, "‹ ____ ›") : example;
}

export function DrillCard({
  card,
  index,
  total,
  onComplete,
}: {
  card: DrillCardType;
  index: number;
  total: number;
  onComplete: (grade: Grade) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [sentence, setSentence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const correct = typed.trim().toLowerCase() === card.text.toLowerCase();
  const blanked = useMemo(
    () => blankExample(card.example_sentence, card.text),
    [card.example_sentence, card.text],
  );

  async function rate(grade: Grade) {
    setSubmitting(true);
    await onComplete(grade);
    // Reset for the next card (component is reused by key, but be safe).
    setRevealed(false);
    setTyped("");
    setSentence("");
    setSubmitting(false);
  }

  const Entry = (
    <div className="animate-rise">
      <p className="font-display text-lg italic text-ink">{card.definition}</p>
      {card.part_of_speech && (
        <p className="eyebrow mt-1">{card.part_of_speech}</p>
      )}
      {card.example_sentence && (
        <p className="mt-4 border-l-2 border-line-strong pl-3 text-ink-soft">
          {card.example_sentence}
        </p>
      )}
    </div>
  );

  return (
    <div className="relative z-10">
      {/* progress + stage */}
      <div className="flex items-center justify-between">
        <span className="label-mono text-ink-faint">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <StageLadder stage={card.stage} />
      </div>

      <p className="eyebrow mt-8">{STAGE_PROMPTS[card.stage]}</p>

      {/* ---- Stage 0: Encounter ---- */}
      {card.stage === STAGE.ENCOUNTER && (
        <div className="mt-4">
          <MorphemeGloss
            word={card.text}
            morphemes={card.morphemes}
            showGloss
            size="5xl"
          />
          <div className="mt-6">{Entry}</div>
          <div className="mt-8 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => rate(Rating.Good)}
              className="border border-ink bg-ink px-4 py-3 label-mono text-paper transition-colors hover:border-accent hover:bg-accent disabled:opacity-40"
            >
              New to me
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => rate(Rating.Easy)}
              className="border border-line-strong px-4 py-3 label-mono text-ink-soft transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
            >
              Already familiar
            </button>
          </div>
        </div>
      )}

      {/* ---- Stage 1: Recognition (see word → recall meaning) ---- */}
      {card.stage === STAGE.RECOGNITION && (
        <div className="mt-4">
          <span className="font-display text-5xl text-ink">{card.text}</span>
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-8 block w-full border border-line-strong py-3 label-mono text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              Reveal meaning
            </button>
          ) : (
            <div className="mt-6">
              <div className="mb-5">
                <MorphemeGloss
                  word={card.text}
                  morphemes={card.morphemes}
            showGloss
                  size="3xl"
                />
              </div>
              {Entry}
              <div className="mt-8">
                <RatingButtons onRate={rate} disabled={submitting} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Stage 2: Cued Recall (definition → produce the word) ---- */}
      {card.stage === STAGE.CUED_RECALL && (
        <div className="mt-4">
          <p className="font-display text-xl italic text-ink">
            {card.definition}
          </p>
          {blanked && (
            <p className="mt-4 border-l-2 border-line-strong pl-3 text-ink-soft">
              {blanked}
            </p>
          )}
          {!revealed ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) setRevealed(true);
              }}
              className="mt-6"
            >
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="the word…"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full border-b border-line-strong bg-transparent px-1 py-2 font-display text-3xl text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!typed.trim()}
                className="mt-4 w-full border border-ink bg-ink py-3 label-mono text-paper transition-colors hover:border-accent hover:bg-accent disabled:opacity-40"
              >
                Check
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <p
                className="label-mono"
                style={{ color: correct ? "var(--accent)" : "var(--flag)" }}
              >
                {correct ? "✓ correct" : `you wrote “${typed}” — it was:`}
              </p>
              <div className="mt-2 mb-6">
                <MorphemeGloss
                  word={card.text}
                  morphemes={card.morphemes}
            showGloss
                  size="3xl"
                />
              </div>
              <RatingButtons
                onRate={rate}
                suggested={correct ? Rating.Good : Rating.Again}
                disabled={submitting}
              />
            </div>
          )}
        </div>
      )}

      {/* ---- Stage 3 + 4: Production (write a sentence) ---- */}
      {(card.stage === STAGE.PRODUCTION ||
        card.stage === STAGE.CONVERSATION) && (
        <div className="mt-4">
          <MorphemeGloss
            word={card.text}
            morphemes={card.morphemes}
            showGloss
            size="5xl"
          />
          {!revealed ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (sentence.trim()) setRevealed(true);
              }}
              className="mt-6"
            >
              <textarea
                autoFocus
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                rows={3}
                placeholder={`Write a sentence using “${card.text}”…`}
                className="w-full resize-none border border-line-strong bg-paper-raised px-3 py-2 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!sentence.trim()}
                className="mt-3 w-full border border-ink bg-ink py-3 label-mono text-paper transition-colors hover:border-accent hover:bg-accent disabled:opacity-40"
              >
                Check my sentence
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <p className="eyebrow">Your sentence</p>
              <p className="mt-1 font-display italic text-ink">{sentence}</p>
              <div className="mt-5 border-t border-line pt-4">{Entry}</div>
              <p className="eyebrow mt-6">Did you use it correctly?</p>
              <div className="mt-2">
                <RatingButtons onRate={rate} disabled={submitting} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
