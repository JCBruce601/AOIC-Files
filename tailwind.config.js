/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0f1729',
        slate: { 850: '#1a2332' },
        accent: { DEFAULT: '#3b82f6', warm: '#f59e0b', cool: '#06b6d4', rose: '#f43f5e' },
      }
    }
  },
  plugins: []
}
