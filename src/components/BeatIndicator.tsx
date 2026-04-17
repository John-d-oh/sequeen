export interface BeatIndicatorProps {
  currentBeat: number; // 1..4
  isPlaying: boolean;
}

export function BeatIndicator({ currentBeat, isPlaying }: BeatIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((b) => {
        const active = isPlaying && b === currentBeat;
        const isDownbeat = b === 1;
        const activeColor = isDownbeat ? '#38bdf8' : '#f43f5e';
        return (
          <div
            key={b}
            className="w-3 h-3 rounded-full border border-slate-600 transition-all"
            style={{
              background: active ? activeColor : 'transparent',
              boxShadow: active ? `0 0 8px ${activeColor}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
