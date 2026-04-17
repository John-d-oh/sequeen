import type { MidiStatus } from '../engine/midiOutput';

/**
 * Prominent banner shown above the main UI when MIDI isn't usable.
 *
 * Four possible states:
 *   - loading      → nothing rendered (silent while requesting access)
 *   - ready + ≥1 output → nothing rendered (all good)
 *   - ready + 0 outputs → "No MIDI outputs found" + per-OS setup instructions
 *   - unsupported  → explanation pointing at a Chromium-based browser
 *   - denied       → instructions to reload + grant permission
 */
export interface ErrorBannerProps {
  status: MidiStatus;
  error: string | null;
  outputCount: number;
}

export function ErrorBanner({ status, error, outputCount }: ErrorBannerProps) {
  if (status === 'loading') return null;
  if (status === 'ready' && outputCount > 0) return null;

  let title: string;
  let body: React.ReactNode;

  if (status === 'unsupported') {
    title = 'Web MIDI is not supported in this browser';
    body = (
      <>
        Use Chrome, Edge, Opera, Arc or another Chromium-based browser. The page
        must be served over <code className="font-mono text-red-200">https://</code>{' '}
        or from <code className="font-mono text-red-200">localhost</code> for
        permission to be granted.
      </>
    );
  } else if (status === 'denied') {
    title = 'MIDI access was denied';
    body = (
      <>
        {error ?? 'Reload the page and allow MIDI access when prompted.'} You
        can also reset the permission for this site in your browser settings
        and reload.
      </>
    );
  } else {
    // status === 'ready' with zero outputs
    title = 'No MIDI outputs found';
    body = (
      <div className="space-y-1">
        <div>
          To hear Sequeen you need at least one MIDI output routed to a synth
          or DAW. Set up a virtual MIDI bus:
        </div>
        <ul className="list-disc ml-6 space-y-0.5">
          <li>
            <strong>macOS</strong> — Open <em>Audio MIDI Setup</em> →{' '}
            <em>Window → Show MIDI Studio</em> → double-click <em>IAC Driver</em>{' '}
            → check <em>Device is online</em>.
          </li>
          <li>
            <strong>Windows</strong> — Install{' '}
            <em>
              <a
                href="https://www.tobias-erichsen.de/software/loopmidi.html"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-red-100"
              >
                loopMIDI
              </a>
            </em>{' '}
            from Tobias Erichsen and add one or more ports.
          </li>
          <li>
            <strong>Linux</strong> — Use ALSA's <em>snd-seq-dummy</em> or{' '}
            <em>a2jmidid</em> to expose a JACK/ALSA bridge your DAW can read.
          </li>
        </ul>
        <div className="text-red-300/80 mt-1">
          After creating a port, reload the page so Sequeen can pick it up.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-900/30 border-y border-red-700/60 px-6 py-3">
      <div className="flex items-start gap-3 max-w-5xl">
        <span
          aria-hidden
          className="text-red-300 text-lg leading-none select-none mt-0.5"
        >
          ⚠
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-red-100 text-sm">{title}</div>
          <div className="text-xs text-red-200/80 mt-1 leading-relaxed">{body}</div>
        </div>
      </div>
    </div>
  );
}
