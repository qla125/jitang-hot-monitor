/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Morandi matcha palette
        matcha: {
          50:  '#f0f4ec',
          100: '#e2ebde',
          200: '#c5d7bf',
          300: '#a8c3a0',
          400: '#8aaf81',
          500: '#7a9e78',  // primary
          600: '#5d8061',
          700: '#476349',
          800: '#324632',
          900: '#2a3320',  // darkest text
        },
        cream: {
          50:  '#fdfcfa',
          100: '#f7f6f2',  // main bg
          200: '#f0ede6',
          300: '#e8e4dc',
        },
        clay: {
          400: '#d4a882',
          500: '#c4906a',  // alert
          600: '#a87354',
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 2.5s ease-in-out infinite',
        'fade-in':   'fadeIn 0.25s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'shimmer':   'shimmer 1.8s linear infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.4', transform: 'scale(0.8)' },
        },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'card':       '0 1px 8px rgba(42,51,32,0.06), 0 0 0 1px rgba(122,158,120,0.08)',
        'card-hover': '0 4px 20px rgba(42,51,32,0.10), 0 0 0 1px rgba(122,158,120,0.15)',
        'glow':       '0 0 20px rgba(122,158,120,0.2)',
        'glow-clay':  '0 0 20px rgba(196,144,106,0.2)',
        'inset-top':  'inset 0 1px 0 rgba(255,255,255,0.8)',
      },
    },
  },
  plugins: [],
}
