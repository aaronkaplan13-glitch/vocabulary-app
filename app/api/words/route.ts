import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateWord } from "@/lib/anthropic";
import { emptyCardState } from "@/lib/fsrs";
import { fetchAllWords, fetchWordWithMorphemes } from "@/lib/words";
import { USER_ID } from "@/lib/config";
import type { MorphemeSpec } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/words — list all words with their morphemes. */
export async function GET() {
  try {
    const words = await fetchAllWords(USER_ID);
    return NextResponse.json({ words });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/words — add a new word.
 * Body: { text: string }
 * Calls Claude for the definition/POS/example/morphemes, inserts the word with
 * a fresh FSRS card, then upserts each morpheme and links it (building the graph).
 */
export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    const word = text?.trim();
    if (!word) {
      return NextResponse.json({ error: "Missing 'text'." }, { status: 400 });
    }

    // 1. Ask Claude for the structured breakdown.
    const gen = await generateWord(word);

    // 2. Insert the word with an empty FSRS card.
    const now = new Date();
    const card = emptyCardState(now);
    const { data: inserted, error: insertErr } = await supabase
      .from("words")
      .insert({
        user_id: USER_ID,
        text: word,
        definition: gen.definition,
        part_of_speech: gen.part_of_speech,
        example_sentence: gen.example_sentence,
        current_stage: 0,
        ...card,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique violation -> the word already exists.
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: `"${word}" is already in your deck.` },
          { status: 409 },
        );
      }
      throw insertErr;
    }

    const wordId = inserted.id as string;

    // 3. Upsert morphemes and link them, preserving order.
    await linkMorphemes(wordId, gen.morphemes);

    // 4. Return the full word with morphemes attached.
    const full = await fetchWordWithMorphemes(wordId);
    return NextResponse.json({ word: full }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function linkMorphemes(wordId: string, specs: MorphemeSpec[]) {
  if (!specs?.length) return;

  // Upsert into the deduplicated morphemes table (unique on type+text).
  const rows = specs.map((m) => ({
    type: m.type,
    text: m.text.toLowerCase(),
    meaning: m.meaning,
  }));
  const { data: upserted, error } = await supabase
    .from("morphemes")
    .upsert(rows, { onConflict: "type,text", ignoreDuplicates: false })
    .select("id, type, text");
  if (error) throw error;

  // Map (type|text) -> id so we can link in the original order.
  const idByKey = new Map(
    (upserted ?? []).map((m) => [`${m.type}|${m.text}`, m.id as string]),
  );

  const links = specs
    .map((m, i) => {
      const id = idByKey.get(`${m.type}|${m.text.toLowerCase()}`);
      return id ? { word_id: wordId, morpheme_id: id, position: i } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (links.length) {
    const { error: linkErr } = await supabase
      .from("word_morphemes")
      .upsert(links, { onConflict: "word_id,morpheme_id" });
    if (linkErr) throw linkErr;
  }
}
