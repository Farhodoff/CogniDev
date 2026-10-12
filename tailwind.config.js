/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#0f1013',
          900: '#131316',
          850: '#1a1a1f',
          800: '#232329',
          700: '#2e2e36',
          600: '#3f3f4a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
