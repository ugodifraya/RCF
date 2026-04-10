/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dce8ff',
          200: '#bad0ff',
          300: '#8aadff',
          400: '#547dff',
          500: '#2a52fe',
          600: '#1a33f5',
          700: '#1524e1',
          800: '#1820b6',
          900: '#1a2190',
          950: '#131557',
        },
        accent: {
          400: '#f97316',
          500: '#ea580c',
        }
      },
    },
  },
  plugins: [],
};
