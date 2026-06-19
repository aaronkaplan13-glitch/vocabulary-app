"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { AddWordForm } from "@/components/AddWordForm";

interface SessionPlan {
  dueReviewCount: number;
  newCap: number;
  newRemaining: number;
  introducedToday: number;
  capReason: string;
  totalWords: number;
  targetWords: string[];
}

export default function TodayPage() {
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load today's plan.");
      setPlan(data);
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

  const toReview = plan?.dueReviewCount ?? 0;
  const toLearn = plan?.newRemaining ?? 0;
  const hasWork = toReview + toLearn > 0;

  return (
    <>
      <Masthead />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-16">
        <p className="eyebrow">Today’s study</p>

        {/* Hero: the plan for today, set as a sentence in the display face. */}
        <h1 className="mt-3 font-display text-3xl leading-snug text-ink sm:text-4xl">
          {loading ? (
            <span className="text-ink-faint">Reading the ledger…</span>
          ) : error ? (
            <span className="text-flag">{error}</span>
          ) : (
            <>
              <span className="text-flag">{toReview}</span> to recall,{" "}
              <span className="text-accent">{toLearn}</span> to meet.
            </>
          )}
        </h1>

        {plan && (
          <p className="mt-4 max-w-prose text-ink-soft">{plan.capReason}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/session"
            aria-disabled={!hasWork}
            className={`border px-5 py-3 label-mono transition-colors ${
              hasWork
                ? "border-ink bg-ink text-paper hover:border-accent hover:bg-accent"
                : "pointer-events-none border-line text-ink-faint"
            }`}
          >
            {hasWork ? "Begin session →" : "Nothing due — add words below"}
          </Link>
          {plan && plan.totalWords > 0 && (
            <Link
              href="/words"
              className="label-mono text-ink-soft underline-offset-4 hover:text-accent hover:underline"
            >
              {plan.totalWords} words in your deck
            </Link>
          )}
        </div>

        {/* Plan breakdown */}
        {plan && (
          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            <Stat label="Due to review" value={toReview} tone="flag" />
            <Stat label="New today" value={toLearn} tone="accent" />
            <Stat
              label="Daily cap"
              value={plan.newCap}
              hint={
                plan.introducedToday > 0
                  ? `${plan.introducedToday} met already`
                  : undefined
              }
            />
          </dl>
        )}

        {/* Add words */}
        <section className="mt-16">
          <p className="eyebrow">Grow the deck</p>
          <p className="mt-2 mb-5 max-w-prose font-display italic text-ink-soft">
            Type a word and Claude will gloss it — definition, part of speech,
            and the roots it’s built from.
          </p>
          <AddWordForm onAdded={load} />
        </section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "flag" | "accent";
}) {
  const color =
    tone === "flag"
      ? "text-flag"
      : tone === "accent"
        ? "text-accent"
        : "text-ink";
  return (
    <div className="bg-paper-raised px-4 py-5">
      <div className={`font-display text-4xl ${color}`}>{value}</div>
      <div className="eyebrow mt-2">{label}</div>
      {hint && <div className="label-mono mt-1 text-ink-faint">{hint}</div>}
    </div>
  );
}
