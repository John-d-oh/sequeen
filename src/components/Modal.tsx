import type { ReactNode } from 'react';
import { useEffect } from 'react';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Accent color for the title bar left border. */
  accent?: string;
}

export function Modal({ title, onClose, children, accent = '#38bdf8' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-bg-800 border border-slate-700 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-slate-700"
          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        >
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: accent }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
