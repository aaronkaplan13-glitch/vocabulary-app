"use client";

import { Rating, type Grade } from "ts-fsrs";

const BUTTONS: {
  grade: Grade;
  label: string;
  hint: string;
  color: string;
  wash: string;
}[] = [
  {
    grade: Rating.Again,
    label: "Again",
    hint: "Forgot",
    color: "var(--flag)",
    wash: "var(--flag-wash)",
  },
  {
    grade: Rating.Hard,
    label: "Hard",
    hint: "Struggled",
    color: "var(--ink-soft)",
    wash: "var(--paper-sunk)",
  },
  {
    grade: Rating.Good,
    label: "Good",
    hint: "Recalled",
    color: "var(--accent)",
    wash: "var(--accent-wash)",
  },
  {
    grade: Rating.Easy,
    label: "Easy",
    hint: "Effortless",
    color: "var(--gold)",
    wash: "var(--gold-wash)",
  },
];

/**
 * The four FSRS grades. `suggested` softly highlights the grade implied by an
 * auto-checked answer, but the learner always makes the final call.
 */
export function RatingButtons({
  onRate,
  suggested,
  disabled,
}: {
  onRate: (grade: Grade) => void;
  suggested?: Grade;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BUTTONS.map((b) => {
        const isSuggested = suggested === b.grade;
        return (
          <button
            key={b.grade}
            type="button"
            disabled={disabled}
            onClick={() => onRate(b.grade)}
            className="group flex flex-col items-center border px-2 py-3 transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{
              borderColor: isSuggested ? b.color : "var(--line-strong)",
              backgroundColor: isSuggested ? b.wash : "transparent",
            }}
          >
            <span
              className="label-mono font-medium"
              style={{ color: b.color }}
            >
              {b.label}
            </span>
            <span className="mt-0.5 text-[0.625rem] text-ink-faint">
              {b.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
