/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f0ff',
          200: '#b9e4ff',
          300: '#89d2ff',
          400: '#52b7ff',
          500: '#2a9ef5',
          600: '#1482e1',
          700: '#0d67b5',
          800: '#115896',
          900: '#134a7a',
        },
      },
    },
  },
  plugins: [],
};
