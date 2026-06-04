/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#050810',
        surface: '#0a0e1a',
        elevated: '#0f1525',
        primary: {
          DEFAULT: '#00f5d4',
          dim: 'rgba(0,245,212,0.15)',
        },
        accent: '#7f5af0',
        alert: '#f5a623',
        danger: '#ff4d4f',
        ink: {
          1: '#e8eaf6',
          2: '#b0b8d4',
          3: '#7c8db5',
          4: '#4a5568',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        sweep: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        blipPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.8)', opacity: '0.4' },
        },
      },
      animation: {
        blip: 'blipPulse 1.5s ease-in-out infinite',
      },
      boxShadow: {
        glow: '0 0 20px rgba(0,245,212,0.25)',
        'glow-alert': '0 0 20px rgba(245,166,35,0.3)',
      },
    },
  },
  plugins: [],
}
