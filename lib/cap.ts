/**
 * Adaptive new-word cap. Protects the daily time budget by holding back new
 * words when the review backlog is heavy.
 *
 *   due reviews > throttle_high (60)        -> cap 0  (clear the backlog first)
 *   throttle_low (40) <= due <= high (60)   -> throttle_mid_cap (2)
 *   due reviews < throttle_low (40)         -> full new_words_cap (5)
 */
export interface CapSettings {
  new_words_cap: number;
  throttle_mid_cap: number;
  throttle_low: number;
  throttle_high: number;
}

export function adaptiveNewWordCap(
  dueReviewCount: number,
  s: CapSettings,
): number {
  if (dueReviewCount > s.throttle_high) return 0;
  if (dueReviewCount >= s.throttle_low) return s.throttle_mid_cap;
  return s.new_words_cap;
}

/** Human-readable reason, surfaced in the UI so the throttle isn't a mystery. */
export function capReason(dueReviewCount: number, s: CapSettings): string {
  if (dueReviewCount > s.throttle_high) {
    return `Reviews are heavy today (${dueReviewCount}). Holding back new words until the backlog clears.`;
  }
  if (dueReviewCount >= s.throttle_low) {
    return `Moderate review load (${dueReviewCount}). Throttling to ${s.throttle_mid_cap} new words.`;
  }
  return `Light review load (${dueReviewCount}). Releasing up to ${s.new_words_cap} new words.`;
}
