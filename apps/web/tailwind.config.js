/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#0E3B2E',
          light: '#1F6B4E',
          50: '#f0f7f4',
        },
        accent: '#4FBF9F',
        gold: '#D4AB53',
        nabgha: {
          bg: '#F7F7F7',
        },
      },
    },
  },
  plugins: [],
}
