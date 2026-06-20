/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#598bff',
          500: '#3563ff',
          600: '#1d40f5',
          700: '#162fe1',
          800: '#1829b6',
          900: '#1a298f',
          950: '#141a57'
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d8e2',
          300: '#aeb6c8',
          400: '#828ea9',
          500: '#63708e',
          600: '#4e5975',
          700: '#404860',
          800: '#383e51',
          900: '#1f2333',
          950: '#13151f'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
        soft: '0 2px 8px rgba(16,24,40,.08)',
        pop: '0 12px 32px rgba(16,24,40,.18)'
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'scale-in': {
          '0%': { opacity: 0, transform: 'scale(.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' }
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'scale-in': 'scale-in .14s ease-out',
        'slide-up': 'slide-up .2s ease-out'
      }
    }
  },
  plugins: []
}
