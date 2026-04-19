/**
 * 16-step position strip for the motif pattern.
 *
 * Each square represents one pattern slot:
 *   - currently-playing step    → solid fill in the part accent + glow
 *   - active steps (within len) → outlined in the part accent
 *   - inactive steps            → dim outlined in --edge
 *
 * The "currently-playing" cell uses an outer glow to read as illuminated,
 * matching the LED-segment-style indicators on synthesisers.
 */
export interface MotifStepIndicatorProps {
  currentStep: number; // 0..15, or -1 when nothing has played yet
  patternLength: number;
  accent: string;
}

export function MotifStepIndicator({
  currentStep,
  patternLength,
  accent,
}: MotifStepIndicatorProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 16 }, (_, i) => {
        const isActive = i < patternLength;
        const isCurrent = i === currentStep;
        return (
          <div
            key={i}
            className="w-3.5 h-3.5 rounded-xs transition-[background-color,box-shadow] duration-120 ease-ui"
            style={{
              background: isCurrent ? accent : 'transparent',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: isActive ? accent : 'var(--edge-2)',
              opacity: isActive ? 1 : 0.45,
              boxShadow: isCurrent
                ? `0 0 10px ${accent}, 0 0 4px ${accent}`
                : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
