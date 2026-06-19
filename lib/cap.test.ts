import { describe, it, expect } from "vitest";
import { adaptiveNewWordCap } from "./cap";

describe("adaptiveNewWordCap", () => {
  const caps = { new_words_cap: 5, throttle_mid_cap: 2, throttle_low: 40, throttle_high: 60 };

  it("throttles new words by review backlog (>60->0, 40-60->2, else 5)", () => {
    expect(adaptiveNewWordCap(10, caps)).toBe(5);
    expect(adaptiveNewWordCap(40, caps)).toBe(2);
    expect(adaptiveNewWordCap(60, caps)).toBe(2);
    expect(adaptiveNewWordCap(61, caps)).toBe(0);
  });
});
