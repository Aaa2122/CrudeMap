import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light "Apple" palette — pearl ground, white surfaces, ink text,
        // soft copper (oil) / blue-green (gas) accents.
        primary: '#3B7BC4', // interactive blue (links, focus)
        bg: '#F5F5F7',
        surface: '#FFFFFF',
        border: 'rgba(0,0,0,0.08)',
        inset: '#F2F2F4', // iOS inset-group background inside white cards
        oil: '#B77A4B',
        gas: '#4A9BAA',
        alert: '#DE5B4E',
        safe: '#3E9E6E',
        // Transitional aliases — deleted in the cleanup task once all
        // component usages are migrated to the tokens above.
        amber: { DEFAULT: '#B77A4B', light: '#C89468' },
        gascyan: '#4A9BAA',
        disrupted: '#DE5B4E',
        rerouted: '#E08D4C',
        text: { DEFAULT: '#1D1D1F', muted: '#6E6E73' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        ctl: '12px',
        card: '16px',
        panel: '20px',
      },
      boxShadow: {
        float: '0 8px 30px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        pop: '0 16px 48px rgba(0,0,0,0.14)',
      },
      letterSpacing: {
        caps: '0.18em', // transitional — removed with .caps-label in cleanup
      },
    },
  },
  plugins: [],
} satisfies Config
