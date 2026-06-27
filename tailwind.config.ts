import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: "#E8735A",
        mint: "#5ABFA8",
      },
    },
  },
  plugins: [],
};

export default config;
