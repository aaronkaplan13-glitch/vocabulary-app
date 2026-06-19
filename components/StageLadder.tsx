import { MAX_STAGE, STAGE_LABELS } from "@/lib/stages";

/**
 * The production-over-recognition ladder, 0→4, rendered as filled rungs.
 * Encounter → Recognition → Cued Recall → Production → Conversation.
 */
export function StageLadder({
  stage,
  showLabel = true,
}: {
  stage: number;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: MAX_STAGE + 1 }, (_, i) => (
          <span
            key={i}
            className="w-[6px] rounded-[1px] transition-colors"
            style={{
              height: `${6 + i * 3}px`,
              backgroundColor:
                i <= stage ? "var(--accent)" : "var(--line-strong)",
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="label-mono text-ink-soft">
          {STAGE_LABELS[stage]}
        </span>
      )}
    </div>
  );
}
