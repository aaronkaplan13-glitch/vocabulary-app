import { supabase } from "./supabase";
import {
  CONVERSATION_TURNS,
  DEFAULT_REQUEST_RETENTION,
  NEW_WORDS_CAP,
  THROTTLE_HIGH,
  THROTTLE_LOW,
  THROTTLE_MID_CAP,
} from "./config";

export interface Settings {
  request_retention: number;
  new_words_cap: number;
  throttle_mid_cap: number;
  throttle_low: number;
  throttle_high: number;
  conversation_turns: number;
}

const FALLBACK: Settings = {
  request_retention: DEFAULT_REQUEST_RETENTION,
  new_words_cap: NEW_WORDS_CAP,
  throttle_mid_cap: THROTTLE_MID_CAP,
  throttle_low: THROTTLE_LOW,
  throttle_high: THROTTLE_HIGH,
  conversation_turns: CONVERSATION_TURNS,
};

/** Load runtime settings from the single-row settings table (with fallback). */
export async function getSettings(): Promise<Settings> {
  const { data } = await supabase
    .from("settings")
    .select(
      "request_retention, new_words_cap, throttle_mid_cap, throttle_low, throttle_high, conversation_turns",
    )
    .eq("id", 1)
    .maybeSingle();
  return data ? { ...FALLBACK, ...data } : FALLBACK;
}
