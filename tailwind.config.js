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
        'bg-primary': '#120009',
        'bg-secondary': '#1D0010',
        'accent-primary': '#EA003A',
        'accent-secondary': '#820065',
        // Halloween Crawl page palette only (app/halloween). Registered as real
        // Tailwind theme colors — not the CSS-variable arbitrary-value shorthand —
        // because `text-[--crimson]/5` style classes silently failed to generate
        // any rule at all (confirmed via computed-style inspection), leaving
        // elements at full opacity / inherited color. Plain hex theme colors use
        // Tailwind's standard opacity-modifier mechanism, which is reliable.
        crimson: '#e90044',
        'halloween-bg': '#11070c',
        'halloween-surface': '#1c0f15',
        'halloween-ivory': '#f2e2cb',
        'halloween-muted': '#bbaea8',
        'halloween-bright': '#ff004c',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        cormorant: ['"Cormorant Garamond"', 'serif'],
      },
    },
  },
  plugins: [],
}
