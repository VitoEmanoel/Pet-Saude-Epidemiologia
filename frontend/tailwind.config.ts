import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        pet: {
          dark: "#143A60",
          mid: "#066F9B",
          light: "#459CD7",
          orange: "#E8531E",
          // Tons com contraste ≥ 4,5:1 para texto (U2): laranja sobre branco/branco sobre laranja
          // e azul-claro sobre o cabeçalho azul-escuro.
          "orange-text": "#C2410C",
          sky: "#8CC8EE",
          red: "#FF0000",
          "red-text": "#C81E1E",
          ice: "#E2E0E0",
          text: "#000000"
        },
        health: {
          50: "#EEF6FB",
          100: "#DCECF7",
          600: "#066F9B",
          700: "#143A60",
          800: "#143A60"
        },
        institutional: {
          50: "#EEF6FB",
          600: "#066F9B",
          800: "#143A60"
        },
        slate: {
          50: "#F5F4F4",
          100: "#E2E0E0",
          200: "#E2E0E0",
          300: "#B7CFE0",
          400: "#64788C",
          500: "#526A80",
          600: "#314A61",
          700: "#1D344A",
          800: "#143A60",
          900: "#143A60",
          950: "#143A60"
        },
        sky: {
          50: "#EEF6FB",
          100: "#DCECF7",
          200: "#A9D0EA",
          700: "#066F9B",
          800: "#143A60",
          900: "#143A60"
        },
        amber: {
          50: "#FFF3EE",
          100: "#FBD5C7",
          200: "#F5A98D",
          700: "#E8531E",
          800: "#A93811",
          900: "#7D2A0D"
        },
        rose: {
          50: "#FFF0F0",
          200: "#FFB3B3",
          700: "#FF0000"
        }
      }
    }
  },
  plugins: []
};

export default config;
