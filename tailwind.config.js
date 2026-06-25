/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#2F002F',
        'bg-secondary': '#1A0015',
        'accent-primary': '#EA003A',
        'accent-secondary': '#820065',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        cormorant: ['"Cormorant Garamond"', 'serif'],
      },
    },
  },
  plugins: [],
}
