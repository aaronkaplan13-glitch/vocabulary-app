import { describe, it, expect } from "vitest";
import { applyReview, emptyCardState, retrievability } from "./fsrs";
import { Rating } from "ts-fsrs";

describe("FSRS scheduling", () => {
  const now = new Date("2026-06-18T12:00:00Z");
  const fresh = emptyCardState(now);
  const good = applyReview(fresh, Rating.Good, now, 0.9);
  const again = applyReview(fresh, Rating.Again, now, 0.9);
  const easy = applyReview(fresh, Rating.Easy, now, 0.9);

  it("records the review and produces positive stability", () => {
    expect(good.card.reps).toBe(1);
    expect(good.card.stability).toBeGreaterThan(0);
  });

  it("orders intervals Again < Good <= Easy", () => {
    const da = +new Date(again.card.due);
    const dg = +new Date(good.card.due);
    const de = +new Date(easy.card.due);
    expect(da).toBeLessThan(dg);
    expect(dg).toBeLessThanOrEqual(de);
  });

  it("schedules a longer interval for lower target retention", () => {
    const dg = +new Date(good.card.due);
    const good85 = applyReview(fresh, Rating.Good, now, 0.85);
    expect(+new Date(good85.card.due)).toBeGreaterThanOrEqual(dg);
  });

  it("decays retrievability into the open interval (0,1)", () => {
    const later = new Date("2026-07-18T12:00:00Z");
    const r = retrievability(
      { ...fresh, stability: good.card.stability, last_review: now.toISOString() },
      later,
    );
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});
