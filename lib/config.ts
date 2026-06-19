/**
 * App-wide configuration. Most knobs are also stored in the `settings` table
 * so they can be tuned at runtime; these are the fallback defaults and the
 * single-user identity for this local-first app.
 */

// Single hardcoded user — no Supabase Auth (see brief: local-first personal app).
export const USER_ID = "local";

// FSRS target retention (probability of recall at the scheduled due date).
export const DEFAULT_REQUEST_RETENTION = 0.9;

// Adaptive new-word cap. See lib/cap.ts.
export const NEW_WORDS_CAP = 5; // base cap when review load is light
export const THROTTLE_MID_CAP = 2; // cap when due reviews are in the mid band
export const THROTTLE_LOW = 40; // below this -> full cap
export const THROTTLE_HIGH = 60; // above this -> cap drops to 0

// Conversation coaching.
export const CONVERSATION_TURNS = 4; // number of user turns
export const CONVERSATION_TARGET_WORDS = 3; // words to weave into the chat

// Claude model used for word generation + conversation coaching.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export const MAXIMUM_INTERVAL = 36500; // days (~100y), FSRS upper bound
