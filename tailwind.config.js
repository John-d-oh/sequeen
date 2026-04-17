/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          900: '#0b0f1a',
          800: '#111827',
          700: '#1a2234',
          600: '#243049',
        },
        accent: {
          pad: '#38bdf8',      // sky
          drone: '#a855f7',    // violet
          motif1: '#22c55e',   // green
          motif2: '#f59e0b',   // amber
        },
      },
    },
  },
  plugins: [],
};
