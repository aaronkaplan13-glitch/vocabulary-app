import { describe, it, expect } from "vitest";
import { nextStage, STAGE } from "./stages";
import { Rating } from "ts-fsrs";

describe("nextStage ladder", () => {
  it("promotes on Good", () => {
    expect(nextStage(STAGE.ENCOUNTER, Rating.Good)).toBe(STAGE.RECOGNITION);
    expect(nextStage(STAGE.RECOGNITION, Rating.Good)).toBe(STAGE.CUED_RECALL);
  });

  it("holds on Hard and on Again at the floor", () => {
    expect(nextStage(STAGE.CUED_RECALL, Rating.Hard)).toBe(STAGE.CUED_RECALL);
    expect(nextStage(STAGE.RECOGNITION, Rating.Again)).toBe(STAGE.RECOGNITION);
  });

  it("demotes on Again", () => {
    expect(nextStage(STAGE.PRODUCTION, Rating.Again)).toBe(STAGE.CUED_RECALL);
  });

  it("caps at the top stage on Easy", () => {
    expect(nextStage(STAGE.CONVERSATION, Rating.Easy)).toBe(STAGE.CONVERSATION);
  });
});
