/** Shared domain types. */

export type MorphemeType =
  | "prefix"
  | "root"
  | "suffix"
  | "infix"
  | "combining";

export interface Morpheme {
  id: string;
  type: MorphemeType;
  text: string;
  meaning: string | null;
}

/** A morpheme as proposed by Claude (before it has a DB id). */
export interface MorphemeSpec {
  type: MorphemeType;
  text: string;
  meaning: string;
}

/** The structured JSON we ask Claude to return when a word is added. */
export interface WordGeneration {
  definition: string;
  part_of_speech: string;
  example_sentence: string;
  morphemes: MorphemeSpec[];
}

/** FSRS card state, mirroring the columns on `words`. */
export interface FsrsState {
  due: string; // ISO timestamp
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review: string | null;
}

export interface Word extends FsrsState {
  id: string;
  user_id: string;
  text: string;
  definition: string | null;
  part_of_speech: string | null;
  example_sentence: string | null;
  notes: string | null;
  current_stage: number; // 0..4
  introduced_on: string | null;
  retrievability: number | null;
  created_at: string;
  updated_at: string;
}

/** A word joined with its morphemes, used in the UI. */
export interface WordWithMorphemes extends Word {
  morphemes: (Morpheme & { position: number })[];
}

/** A due card prepared for the drill, including how it should be tested. */
export interface DrillCard extends WordWithMorphemes {
  /** Stage the card will be tested at this session. */
  stage: number;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ConversationEvaluation {
  score: number; // 0-100
  words_used: string[]; // target words used naturally
  feedback: string;
}
