/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ramadan-teal': '#1a4d4d',
        'ramadan-gold': '#d4af37',
        'ramadan-cream': '#f5e6c4',
        'ramadan-orange': '#ff8c00',
        'ramadan-green': '#2ecc71',
        'ramadan-red': '#e74c3c',
        'ramadan-grey': '#7f8c8d',
      },
      fontFamily: {
        'arabic': ["Cairo", "sans-serif"],
        'serif-arabic': ["Amiri", "serif"],
      },
      keyframes: {
        heartbeat: {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.05)' },
          '50%': { transform: 'scale(1)' },
          '75%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        }
      },
      animation: {
        heartbeat: 'heartbeat 1s infinite',
      }
    },
  },
  plugins: [],
}
