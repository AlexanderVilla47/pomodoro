/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: "#E8735A",
        mint: "rgb(var(--color-mint-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
