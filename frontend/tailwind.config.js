/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F1A',
        card: '#111827',
        primary: {
          DEFAULT: '#8B5CF6',
          soft: '#A78BFA',
        },
        secondary: {
          DEFAULT: '#22D3EE',
          soft: '#67E8F9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(139,92,246,0.55)',
        glowCyan: '0 0 40px -10px rgba(34,211,238,0.55)',
        card: '0 10px 40px -20px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'grad-primary': 'linear-gradient(135deg, #8B5CF6 0%, #22D3EE 100%)',
        'grad-radial':
          'radial-gradient(1200px 600px at 10% -10%, rgba(139,92,246,0.25), transparent 60%), radial-gradient(900px 500px at 100% 10%, rgba(34,211,238,0.18), transparent 60%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(2deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
