import type { MorphemeType } from "@/lib/types";

const SEG_COLOR: Record<MorphemeType, string> = {
  prefix: "var(--m-prefix)",
  root: "var(--m-root)",
  suffix: "var(--m-suffix)",
  infix: "var(--m-other)",
  combining: "var(--m-other)",
};

export interface GlossMorpheme {
  type: MorphemeType;
  text: string;
  meaning: string | null;
  position?: number;
}

/**
 * The signature element. The headword reads as a single word, segmented by
 * per-morpheme underlines in their type colors. When `showGloss` is set, the
 * meanings appear in a compact legend beneath — keeping long meanings readable
 * without stretching the word apart.
 */
export function MorphemeGloss({
  word,
  morphemes,
  size = "5xl",
  showGloss = false,
}: {
  word: string;
  morphemes: GlossMorpheme[];
  size?: "3xl" | "5xl" | "7xl";
  showGloss?: boolean;
}) {
  const formSize =
    size === "7xl"
      ? "text-6xl sm:text-7xl"
      : size === "5xl"
        ? "text-4xl sm:text-5xl"
        : "text-2xl sm:text-3xl";

  if (!morphemes?.length) {
    return <span className={`font-display ${formSize} text-ink`}>{word}</span>;
  }

  const ordered = [...morphemes].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <div>
      <div className="headword" aria-label={`${word}, by morpheme`}>
        {ordered.map((m, i) => (
          <span
            key={`${m.text}-${i}`}
            className={`headword-seg ${formSize}`}
            style={{ ["--seg-color" as string]: SEG_COLOR[m.type] }}
          >
            {m.text}
          </span>
        ))}
      </div>

      {showGloss && (
        <div className="gloss-legend mt-3">
          {ordered.map(
            (m, i) =>
              m.meaning && (
                <span
                  key={`${m.text}-leg-${i}`}
                  className="gloss-legend-item"
                  style={{ ["--seg-color" as string]: SEG_COLOR[m.type] }}
                >
                  <b>{m.text}</b>
                  {m.meaning}
                </span>
              ),
          )}
        </div>
      )}
    </div>
  );
}
