/**
 * Keyboard-shortcut help overlay. Triggered by the `?` button in the
 * top bar or by pressing `?` anywhere (unless a text input is focused).
 *
 * Organised into three columns matching the app's mental model:
 *   - Transport (global play / panic / progression)
 *   - Chord buttons (I–VII + borrowed modifiers)
 *   - Navigation (focus, close)
 *
 * Closes on Escape or on backdrop click.
 */

import { useEffect } from 'react';

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

const TRANSPORT: Shortcut[] = [
  { keys: ['Space'], label: 'Play / Stop all parts' },
  { keys: ['P'], label: 'Panic — all notes off' },
  { keys: ['Shift', 'P'], label: 'Play / Pause progression' },
];

const CHORDS: Shortcut[] = [
  { keys: ['1'], label: 'Chord degree I' },
  { keys: ['2'], label: 'Chord degree ii' },
  { keys: ['3'], label: 'Chord degree iii' },
  { keys: ['4'], label: 'Chord degree IV' },
  { keys: ['5'], label: 'Chord degree V' },
  { keys: ['6'], label: 'Chord degree vi' },
  { keys: ['7'], label: 'Chord degree vii°' },
];

const NAVIGATION: Shortcut[] = [
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close dialogs' },
  { keys: ['Tab'], label: 'Focus next control' },
  { keys: ['Shift', 'Tab'], label: 'Focus previous control' },
];

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 text-[11px] font-mono bg-bg-700 border border-slate-600 rounded text-slate-100 shadow-[0_1px_0_#334155]">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, label }: Shortcut) {
  return (
    <li className="flex items-center justify-between gap-3 py-1">
      <span className="type-body text-slate-300">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-600 text-xs">+</span>}
            <KeyChip>{k}</KeyChip>
          </span>
        ))}
      </span>
    </li>
  );
}

function Section({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <section>
      <h3 className="type-label mb-2">{title}</h3>
      <ul className="space-y-0.5">
        {items.map((s) => (
          <ShortcutRow key={s.label} {...s} />
        ))}
      </ul>
    </section>
  );
}

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-bg-800 border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h2 className="type-title">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-bg-700"
            aria-label="Close help"
          >
            ×
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-5">
          <Section title="Transport" items={TRANSPORT} />
          <Section title="Chord degrees" items={CHORDS} />
          <Section title="Navigation" items={NAVIGATION} />
        </div>

        <footer className="px-5 py-3 border-t border-slate-700 type-body text-slate-500">
          Tip: shortcuts are ignored while typing in an input or dropdown.
        </footer>
      </div>
    </div>
  );
}
