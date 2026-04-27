/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0f4ff',
          100: '#dce8ff',
          200: '#b9d0ff',
          300: '#8ab0ff',
          400: '#6690ff',
          500: '#4d6fff',
          600: '#3b52f5',
          700: '#2e3fe0',
          800: '#2230b4',
          900: '#1e2a8e',
          950: '#131557',
        },
        accent: {
          400: '#f97316',
          500: '#ea580c',
        },
      },
    },
  },
  plugins: [],
};
