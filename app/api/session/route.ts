import { NextResponse } from "next/server";
import { fetchAllWords, shuffle, todayDate } from "@/lib/words";
import { getSettings } from "@/lib/settings";
import { adaptiveNewWordCap, capReason } from "@/lib/cap";
import { USER_ID, CONVERSATION_TARGET_WORDS } from "@/lib/config";
import { STAGE } from "@/lib/stages";
import type { DrillCard, WordWithMorphemes } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/session — assemble today's daily session.
 * Returns interleaved due cards (each tested at its current stage), the
 * adaptive new-word allocation, and the target words for conversation mode.
 */
export async function GET() {
  try {
    const now = new Date();
    const today = todayDate(now);
    const settings = await getSettings();

    const all = await fetchAllWords(USER_ID);

    // Due reviews: words already introduced whose FSRS due date has arrived.
    const due = all.filter(
      (w) => w.introduced_on !== null && new Date(w.due) <= now,
    );
    const dueReviewCount = due.length;

    // Adaptive cap, minus any new words already introduced today.
    const cap = adaptiveNewWordCap(dueReviewCount, settings);
    const introducedToday = all.filter(
      (w) => w.introduced_on === today,
    ).length;
    const newRemaining = Math.max(0, cap - introducedToday);

    // New words = brand-new (never introduced), oldest first, limited to allowance.
    const newWords = all
      .filter((w) => w.introduced_on === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, newRemaining);

    // Interleave the due cards (mix stages + words), each at its current stage.
    const dueCards: DrillCard[] = shuffle(due).map((w) => ({
      ...w,
      stage: Math.max(STAGE.RECOGNITION, w.current_stage),
    }));

    const newCards: DrillCard[] = newWords.map((w) => ({
      ...w,
      stage: STAGE.ENCOUNTER,
    }));

    // Conversation targets: prefer production-ready words (stage >= 3) that are
    // due; fall back to the highest-stage due words so there's always practice.
    const targetWords = pickTargetWords(due, all);

    return NextResponse.json({
      dueCards,
      newCards,
      dueReviewCount,
      newCap: cap,
      newRemaining,
      introducedToday,
      capReason: capReason(dueReviewCount, settings),
      targetWords,
      totalWords: all.length,
      conversationTurns: settings.conversation_turns,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function pickTargetWords(
  due: WordWithMorphemes[],
  all: WordWithMorphemes[],
): string[] {
  const ranked = [...due].sort((a, b) => b.current_stage - a.current_stage);
  let pool = ranked.filter((w) => w.current_stage >= STAGE.PRODUCTION);
  if (pool.length < CONVERSATION_TARGET_WORDS) pool = ranked;
  if (pool.length < CONVERSATION_TARGET_WORDS) {
    // Fall back to any introduced words at all, highest stage first.
    pool = [...all]
      .filter((w) => w.introduced_on !== null)
      .sort((a, b) => b.current_stage - a.current_stage);
  }
  return pool.slice(0, CONVERSATION_TARGET_WORDS).map((w) => w.text);
}
