import { NextResponse } from "next/server";
import { type Grade } from "ts-fsrs";
import { supabase } from "@/lib/supabase";
import { applyReview, fromCard, retrievability } from "@/lib/fsrs";
import { getSettings } from "@/lib/settings";
import { nextStage } from "@/lib/stages";
import { todayDate } from "@/lib/words";
import { USER_ID } from "@/lib/config";
import type { FsrsState } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/reviews — submit a drill answer.
 * Body: { wordId: string, rating: 1|2|3|4 }  (ts-fsrs Rating: Again..Easy)
 *
 * Applies the FSRS scheduler, advances the production stage, writes the new
 * card state to the word, and appends an immutable review log row.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { wordId?: string; rating?: number };
    const { wordId } = body;
    const rating = body.rating as Grade | undefined;

    if (!wordId || !rating || rating < 1 || rating > 4) {
      return NextResponse.json(
        { error: "Provide wordId and rating (1-4)." },
        { status: 400 },
      );
    }

    const { data: word, error: loadErr } = await supabase
      .from("words")
      .select("*")
      .eq("id", wordId)
      .single();
    if (loadErr || !word) {
      return NextResponse.json({ error: "Word not found." }, { status: 404 });
    }

    const settings = await getSettings();
    const now = new Date();

    const prevState: FsrsState = {
      due: word.due,
      stability: word.stability,
      difficulty: word.difficulty,
      elapsed_days: word.elapsed_days,
      scheduled_days: word.scheduled_days,
      reps: word.reps,
      lapses: word.lapses,
      learning_steps: word.learning_steps,
      state: word.state,
      last_review: word.last_review,
    };

    // FSRS scheduling.
    const result = applyReview(
      prevState,
      rating,
      now,
      settings.request_retention,
    );
    const nextFsrs = fromCard(result.card);
    const r = retrievability(nextFsrs, now);

    // Stage progression (production-over-recognition ladder).
    const stageBefore = word.current_stage as number;
    const stageAfter = nextStage(stageBefore, rating);

    // First study of a brand-new word stamps introduced_on (drives the cap).
    const introduced_on = word.introduced_on ?? todayDate(now);

    const { error: updErr } = await supabase
      .from("words")
      .update({
        ...nextFsrs,
        current_stage: stageAfter,
        introduced_on,
        retrievability: r,
      })
      .eq("id", wordId);
    if (updErr) throw updErr;

    // Append the review log.
    const { error: logErr } = await supabase.from("reviews").insert({
      word_id: wordId,
      user_id: USER_ID,
      rating,
      stage_before: stageBefore,
      stage_after: stageAfter,
      state: result.log.state,
      due: nextFsrs.due,
      stability: nextFsrs.stability,
      difficulty: nextFsrs.difficulty,
      elapsed_days: result.log.elapsed_days,
      scheduled_days: result.log.scheduled_days,
      last_elapsed_days: result.log.last_elapsed_days,
      retrievability: r,
      reviewed_at: now.toISOString(),
    });
    if (logErr) throw logErr;

    return NextResponse.json({
      wordId,
      stageBefore,
      stageAfter,
      due: nextFsrs.due,
      scheduled_days: result.log.scheduled_days,
      stability: nextFsrs.stability,
      retrievability: r,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
