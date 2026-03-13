import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#009dff',
        bg: '#0f1b23',
        surface: '#162631',
        border: '#2e546b',
        amber: { DEFAULT: '#f59e0b', light: '#fbbf24' },
        disrupted: '#ef4444',
        rerouted: '#f97316',
        safe: '#22c55e',
        text: { DEFAULT: '#e2e8f0', muted: '#64748b' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
