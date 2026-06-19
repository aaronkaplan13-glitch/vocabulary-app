"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ConversationEvaluation } from "@/lib/types";

// Hidden kickoff turn so Claude opens the conversation. Never shown or saved.
const SEED: ChatMessage = {
  role: "user",
  content:
    "I'm ready to chat. Greet me warmly and ask one opening question to get us started.",
};

function countUserTurns(msgs: ChatMessage[]): number {
  return msgs.filter((m) => m.role === "user").length;
}

/** Client-side check of which target words have surfaced in the learner's turns. */
function usedSoFar(msgs: ChatMessage[], targets: string[]): Set<string> {
  const learner = msgs
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return new Set(
    targets.filter((t) => new RegExp(`\\b${t.toLowerCase()}`).test(learner)),
  );
}

export function ConversationCoach({
  targetWords,
  maxTurns,
  onFinish,
}: {
  targetWords: string[];
  maxTurns: number;
  onFinish: (evaluation: ConversationEvaluation) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userTurns = countUserTurns(messages);
  const used = usedSoFar(messages, targetWords);
  const done = userTurns >= maxTurns;

  const ask = useCallback(async (history: ChatMessage[]): Promise<string> => {
    const res = await fetch("/api/conversation/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetWords, messages: [SEED, ...history] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "The coach went quiet.");
    return data.reply as string;
  }, [targetWords]);

  // Coach opens the conversation.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setThinking(true);
      try {
        const reply = await ask([]);
        setMessages([{ role: "assistant", content: reply }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setThinking(false);
      }
    })();
  }, [ask]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  async function finish(history: ChatMessage[]) {
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWords, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not score the chat.");
      onFinish(data.evaluation as ConversationEvaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEvaluating(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking || evaluating) return;
    const withUser: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(withUser);
    setDraft("");
    setThinking(true);
    setError(null);
    try {
      const reply = await ask(withUser);
      const withReply: ChatMessage[] = [
        ...withUser,
        { role: "assistant", content: reply },
      ];
      setMessages(withReply);
      if (countUserTurns(withReply) >= maxTurns) {
        await finish(withReply);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Conversation · active recall</p>
        <span className="label-mono text-ink-faint">
          turn {Math.min(userTurns + (done ? 0 : 1), maxTurns)} / {maxTurns}
        </span>
      </div>

      {/* Target words to weave in */}
      <div className="mt-3 flex flex-wrap gap-2">
        {targetWords.map((w) => {
          const hit = used.has(w);
          return (
            <span
              key={w}
              className="border px-2 py-1 font-display text-sm transition-colors"
              style={{
                borderColor: hit ? "var(--accent)" : "var(--line-strong)",
                backgroundColor: hit ? "var(--accent-wash)" : "transparent",
                color: hit ? "var(--accent)" : "var(--ink-soft)",
              }}
            >
              {hit ? "✓ " : ""}
              {w}
            </span>
          );
        })}
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="mt-5 max-h-[46vh] space-y-4 overflow-y-auto border-y border-line py-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex"}
          >
            <div
              className={`max-w-[80%] px-3 py-2 ${
                m.role === "user"
                  ? "bg-accent text-paper"
                  : "border-l-2 border-line-strong text-ink"
              }`}
            >
              {m.role === "assistant" && (
                <span className="eyebrow mb-1 block">Coach</span>
              )}
              <p className={m.role === "assistant" ? "font-display italic" : ""}>
                {m.content}
              </p>
            </div>
          </div>
        ))}
        {(thinking || evaluating) && (
          <p className="eyebrow">{evaluating ? "Scoring…" : "Coach is typing…"}</p>
        )}
      </div>

      {error && (
        <p className="mt-3 label-mono text-flag" role="alert">
          {error}
        </p>
      )}

      {/* Composer / finish */}
      {!done ? (
        <form onSubmit={send} className="mt-4 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={2}
            placeholder="Your reply… (try to use a target word)"
            disabled={thinking || evaluating}
            className="flex-1 resize-none border border-line-strong bg-paper-raised px-3 py-2 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || thinking || evaluating}
            className="border border-ink bg-ink px-4 py-3 label-mono text-paper transition-colors hover:border-accent hover:bg-accent disabled:opacity-40"
          >
            Send
          </button>
        </form>
      ) : (
        !evaluating && (
          <p className="mt-4 eyebrow">Conversation complete — scoring…</p>
        )
      )}

      {messages.length > 0 && !done && (
        <button
          type="button"
          onClick={() => finish(messages)}
          disabled={evaluating || thinking}
          className="mt-3 label-mono text-ink-faint underline-offset-4 hover:text-accent hover:underline disabled:opacity-40"
        >
          End & score now
        </button>
      )}
    </div>
  );
}
