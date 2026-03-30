/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0a47c2',
        'background-light': '#f5f6f8',
        'background-dark': '#101622',
        /** Admin console (university management dark shell) */
        'admin-bg': '#0f172a',
        'admin-card': '#111827',
        'admin-sidebar': '#020617',
      },
      boxShadow: {
        'admin-card': '0 4px 28px -6px rgba(0, 0, 0, 0.55)',
        'admin-card-hover': '0 8px 40px -8px rgba(59, 130, 246, 0.18), 0 4px 28px -6px rgba(0, 0, 0, 0.5)',
        'admin-glow-sm': '0 0 20px -4px rgba(99, 102, 241, 0.25)',
      },
      fontFamily: {
        display: ['Public Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      keyframes: {
        'toast-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.3s ease-out forwards',
        'toast-out': 'toast-out 0.3s ease-in forwards',
      },
    },
  },
  plugins: [],
}
