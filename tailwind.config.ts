import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#08090d",
        panel: "#11131a",
        line: "#2b2f3a",
        gold: "#60a5fa",
        ember: "#e35f3b",
        jade: "#40b88a"
      }
    }
  },
  plugins: []
};

export default config;
