/**
 * 16-step position strip for the motif pattern.
 *
 * Each square represents one pattern slot. The currently-playing step is
 * filled and glowing in the accent color; active steps (within
 * `patternLength`) are outlined; inactive steps are dimmed.
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
            className="w-3.5 h-3.5 rounded-sm transition-all"
            style={{
              background: isCurrent ? accent : 'transparent',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: isActive ? accent : '#334155',
              opacity: isActive ? 1 : 0.3,
              boxShadow: isCurrent ? `0 0 6px ${accent}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
