import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        campus: {
          navy: "#1E3A5F",
          navyDark: "#152943",
          blue: "#1D4ED8",
          ochre: "#B45309",
          ochreLight: "#FEF3C7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
