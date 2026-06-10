import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Intelligence terminal" palette — deep ocean ground, one cold accent,
        // commodity accents (oil amber / gas cyan) applied locally.
        primary: '#6FB7D6',
        bg: '#050B12',
        surface: '#0A131D',
        border: '#1A2937',
        amber: { DEFAULT: '#DCA54A', light: '#E9BC6F' },
        gascyan: '#46C8DC',
        disrupted: '#D9544D',
        rerouted: '#D98143',
        safe: '#46A87C',
        text: { DEFAULT: '#D8E3EC', muted: '#5E7485' },
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      letterSpacing: {
        caps: '0.18em',
      },
    },
  },
  plugins: [],
} satisfies Config
