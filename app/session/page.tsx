"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Grade } from "ts-fsrs";
import { Masthead } from "@/components/Masthead";
import { DrillCard } from "@/components/DrillCard";
import { ConversationCoach } from "@/components/ConversationCoach";
import { STAGE_LABELS } from "@/lib/stages";
import type {
  ConversationEvaluation,
  DrillCard as DrillCardType,
} from "@/lib/types";

type Phase = "loading" | "error" | "drill" | "conversation" | "summary";

interface SessionData {
  dueCards: DrillCardType[];
  newCards: DrillCardType[];
  targetWords: string[];
  conversationTurns: number;
}

interface ReviewOutcome {
  stageBefore: number;
  stageAfter: number;
}

export default function SessionPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<DrillCardType[]>([]);
  const [index, setIndex] = useState(0);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [turns, setTurns] = useState(4);
  const [outcomes, setOutcomes] = useState<ReviewOutcome[]>([]);
  const [evaluation, setEvaluation] = useState<ConversationEvaluation | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const data: SessionData & { error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not start session.");
        // Reviews first (interleaved by the server), new encounters last.
        const q = [...data.dueCards, ...data.newCards];
        setQueue(q);
        setTargetWords(data.targetWords ?? []);
        setTurns(data.conversationTurns ?? 4);
        setPhase(q.length ? "drill" : afterDrill(data.targetWords));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    })();
  }, []);

  function afterDrill(targets: string[]): Phase {
    return targets && targets.length >= 2 ? "conversation" : "summary";
  }

  async function handleReview(grade: Grade) {
    const card = queue[index];
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: card.id, rating: grade }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutcomes((o) => [
          ...o,
          { stageBefore: data.stageBefore, stageAfter: data.stageAfter },
        ]);
      }
    } catch {
      // Non-fatal: keep the session moving even if one write fails.
    }
    const next = index + 1;
    if (next >= queue.length) {
      setPhase(afterDrill(targetWords));
    } else {
      setIndex(next);
    }
  }

  return (
    <>
      <Masthead />
      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:py-14">
        {phase === "loading" && (
          <p className="eyebrow">Assembling today’s session…</p>
        )}

        {phase === "error" && (
          <div>
            <p className="font-display text-2xl text-flag">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-block label-mono text-accent hover:underline"
            >
              ← Back to today
            </Link>
          </div>
        )}

        {phase === "drill" && queue[index] && (
          <DrillCard
            key={queue[index].id}
            card={queue[index]}
            index={index}
            total={queue.length}
            onComplete={handleReview}
          />
        )}

        {phase === "conversation" && (
          <ConversationCoach
            targetWords={targetWords}
            maxTurns={turns}
            onFinish={(evalResult) => {
              setEvaluation(evalResult);
              setPhase("summary");
            }}
          />
        )}

        {phase === "summary" && (
          <Summary outcomes={outcomes} evaluation={evaluation} />
        )}
      </main>
    </>
  );
}

function Summary({
  outcomes,
  evaluation,
}: {
  outcomes: ReviewOutcome[];
  evaluation: ConversationEvaluation | null;
}) {
  const reviewed = outcomes.length;
  const promoted = outcomes.filter((o) => o.stageAfter > o.stageBefore).length;
  const promotions = outcomes.filter((o) => o.stageAfter > o.stageBefore);

  return (
    <div className="animate-rise">
      <p className="eyebrow">Session complete</p>
      <h1 className="mt-3 font-display text-4xl text-ink">
        {reviewed} reviewed,{" "}
        <span className="text-accent">{promoted} advanced</span>.
      </h1>

      {promotions.length > 0 && (
        <ul className="mt-8 space-y-2">
          {promotions.slice(0, 8).map((p, i) => (
            <li key={i} className="label-mono text-ink-soft">
              {STAGE_LABELS[p.stageBefore]} → {" "}
              <span className="text-accent">{STAGE_LABELS[p.stageAfter]}</span>
            </li>
          ))}
        </ul>
      )}

      {evaluation && (
        <div className="mt-10 border-l-2 border-gold pl-4">
          <p className="eyebrow">Conversation score</p>
          <p className="mt-1 font-display text-5xl text-gold">
            {evaluation.score}
            <span className="text-2xl text-ink-faint"> / 100</span>
          </p>
          {evaluation.words_used.length > 0 && (
            <p className="mt-2 label-mono text-ink-soft">
              Used naturally: {evaluation.words_used.join(", ")}
            </p>
          )}
          <p className="mt-3 max-w-prose font-display italic text-ink">
            {evaluation.feedback}
          </p>
        </div>
      )}

      <div className="mt-12 flex gap-3">
        <Link
          href="/"
          className="border border-ink bg-ink px-5 py-3 label-mono text-paper transition-colors hover:border-accent hover:bg-accent"
        >
          ← Back to today
        </Link>
        <Link
          href="/words"
          className="border border-line-strong px-5 py-3 label-mono text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          Browse deck
        </Link>
      </div>
    </div>
  );
}
