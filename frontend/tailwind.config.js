/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        alfa: {
          red: '#EF3124',
          hover: '#D92015',
          dark: '#0F1218',
          card: '#181C24',
          border: '#272C38',
          muted: '#8A94A6',
          surface: '#F8F9FB',
        }
      }
    },
  },
  plugins: [],
}
