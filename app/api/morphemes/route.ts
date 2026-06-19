import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/morphemes — the auto-assembled morpheme graph: each morpheme with
 * the words that share it. Useful for surfacing connections between words.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("morphemes")
      .select("id, type, text, meaning, word_morphemes(words(id, text))")
      .order("text", { ascending: true });
    if (error) throw error;

    type WordRef = { id: string; text: string };
    const morphemes = (data ?? []).map((m) => {
      const links = (m.word_morphemes ?? []) as unknown as {
        words: WordRef | WordRef[] | null;
      }[];
      const words = links.flatMap((l) =>
        !l.words ? [] : Array.isArray(l.words) ? l.words : [l.words],
      );
      return {
        id: m.id,
        type: m.type,
        text: m.text,
        meaning: m.meaning,
        words,
      };
    });

    // Most-connected first; these are the high-leverage roots/affixes.
    morphemes.sort((a, b) => b.words.length - a.words.length);
    return NextResponse.json({ morphemes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
