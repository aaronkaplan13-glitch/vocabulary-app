import { supabase } from "./supabase";
import type { Morpheme, WordWithMorphemes } from "./types";

const WORD_SELECT =
  "*, word_morphemes(position, morphemes(id, type, text, meaning))";

interface RawJoin {
  position: number;
  morphemes: Morpheme | null;
}

/** Flatten Supabase's nested join shape into a clean WordWithMorphemes. */
function flatten(row: Record<string, unknown>): WordWithMorphemes {
  const joins = (row.word_morphemes as RawJoin[] | null) ?? [];
  const morphemes = joins
    .filter((j) => j.morphemes)
    .map((j) => ({ ...(j.morphemes as Morpheme), position: j.position }))
    .sort((a, b) => a.position - b.position);
  const { word_morphemes: _omit, ...word } = row;
  void _omit;
  return { ...(word as unknown as WordWithMorphemes), morphemes };
}

export async function fetchWordWithMorphemes(
  id: string,
): Promise<WordWithMorphemes | null> {
  const { data, error } = await supabase
    .from("words")
    .select(WORD_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? flatten(data) : null;
}

export async function fetchAllWords(
  userId: string,
): Promise<WordWithMorphemes[]> {
  const { data, error } = await supabase
    .from("words")
    .select(WORD_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(flatten);
}

/** Today's date in YYYY-MM-DD (server-local), for the introduced_on / cap logic. */
export function todayDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Fisher-Yates shuffle, used to interleave drill cards. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
