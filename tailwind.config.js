/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ----------------------------------------------------------------
      // Type system — three families, four+ tiers.
      // ----------------------------------------------------------------
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'JetBrainsMono',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        // Synthwave token tiers.
        lbl: ['11px', { lineHeight: '1.2', letterSpacing: '0.22em' }],
        body: ['14px', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
        value: ['22px', { lineHeight: '1', letterSpacing: '0.02em' }],
        'value-lg': ['28px', { lineHeight: '1', letterSpacing: '0.02em' }],
        title: ['22px', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'title-lg': ['28px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        brand: ['26px', { lineHeight: '1', letterSpacing: '-0.02em' }],
      },

      // ----------------------------------------------------------------
      // Colour system — synthwave palette.
      //
      // The new tokens are the canonical names (ink, fg, pad, drone, …).
      // The legacy `bg-*` aliases below preserve compatibility with every
      // component that still uses `bg-bg-900` / `bg-bg-800` / etc. so we
      // can refresh tokens here without touching individual files yet.
      // ----------------------------------------------------------------
      colors: {
        // Surfaces — deepest to lightest.
        ink: '#07060E',         // base canvas
        'ink-2': '#0C0A18',     // raised panel floor
        'ink-3': '#120F22',     // panel
        'ink-4': '#1A1631',     // elevated tile
        'ink-deep': '#050410',
        edge: '#251E42',        // 1px borders
        'edge-2': '#2E265A',    // hover border

        // Foreground.
        fg: '#E9E4FF',
        'fg-dim': '#B4A9D6',
        'fg-mute': '#6F6691',

        // Part accents.
        pad: '#00D9FF',
        'pad-2': '#5CE8FF',
        drone: '#FF2BD6',
        'drone-2': '#FF5BE0',
        motif1: '#B56BFF',
        motif2: '#FFB547',

        // Status.
        ok: '#4EF0C1',
        siren: '#FF4E6B',
        warn: '#FFB547',

        // ---- Legacy aliases (do not delete until all components migrate) ----
        bg: {
          void: '#050410',
          deep: '#07060E',
          900: '#07060E',       // page background
          surface: '#120F22',
          800: '#120F22',       // panel
          raised: '#1A1631',
          700: '#1A1631',       // raised
          sunken: '#0C0A18',
          600: '#251E42',
        },
        accent: {
          pad: '#00D9FF',
          drone: '#FF2BD6',
          motif1: '#B56BFF',
          motif2: '#FFB547',
        },
      },

      // ----------------------------------------------------------------
      // Border radii — granular synthwave scale.
      // ----------------------------------------------------------------
      borderRadius: {
        xs: '2px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
        '4xl': '18px',
        '5xl': '20px',
        pill: '9999px',
      },

      // ----------------------------------------------------------------
      // Shadows — surface depth + neon bloom.
      // Use `var(--accent)` inside components so the bloom inherits the
      // active part colour without us writing 4× shadow variants.
      // ----------------------------------------------------------------
      boxShadow: {
        panel:
          'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.35)',
        'panel-playing':
          'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px color-mix(in srgb, var(--accent) 38%, transparent), 0 24px 60px rgba(0,0,0,0.45), 0 0 60px color-mix(in srgb, var(--accent) 22%, transparent)',
        raised:
          'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 0 rgba(0,0,0,0.3)',
        'raised-hover': '0 0 0 3px rgba(0,217,255,0.08)',
        knob:
          'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -6px 14px rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.6)',
        sunken:
          'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 6px 16px rgba(0,0,0,0.5)',
        'sunken-focus':
          'inset 0 0 20px rgba(0,217,255,0.12), 0 0 0 3px rgba(0,217,255,0.08)',
        'glow-cy': '0 0 22px rgba(0,217,255,0.45), 0 0 44px rgba(0,217,255,0.18)',
        'glow-mag':
          '0 0 22px rgba(255,43,214,0.45), 0 0 44px rgba(255,43,214,0.20)',
        'glow-vi':
          '0 0 22px rgba(181,107,255,0.40), 0 0 44px rgba(181,107,255,0.18)',
        'glow-am':
          '0 0 22px rgba(255,181,71,0.45), 0 0 44px rgba(255,181,71,0.18)',
        'focus-mag': '0 0 0 3px rgba(255,43,214,0.35)',
        'focus-cy': '0 0 0 3px rgba(0,217,255,0.35)',
        chrome:
          'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.45)',
      },

      // ----------------------------------------------------------------
      // Transitions / animations.
      // ----------------------------------------------------------------
      transitionTimingFunction: {
        'ease-ui': 'cubic-bezier(0.2, 0, 0, 1)',          // hovers / presses
        'ease-mech': 'cubic-bezier(0.4, 0, 0.2, 1)',      // knobs / transport
        'ease-breath': 'cubic-bezier(0.4, 0, 0.6, 1)',    // pulse / breath
      },
      transitionDuration: {
        120: '120ms',
        200: '200ms',
        400: '400ms',
      },
      keyframes: {
        breath: {
          '0%,100%': { boxShadow: '0 0 14px var(--accent)' },
          '50%': {
            boxShadow:
              '0 0 26px var(--accent), 0 0 46px var(--accent)',
          },
        },
        pulse: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.35)' },
        },
        scan: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(10px)', opacity: '0' },
        },
      },
      animation: {
        breath: 'breath 1.6s ease-in-out infinite',
        pulse: 'pulse 1.2s ease-in-out infinite',
        scan: 'scan 2.4s linear infinite',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
