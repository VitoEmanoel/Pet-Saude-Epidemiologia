import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        health: {
          50: "#eefaf4",
          100: "#d8f3e6",
          600: "#178354",
          700: "#126a45"
        },
        institutional: {
          50: "#eff6ff",
          600: "#2563eb",
          800: "#1e3a8a"
        }
      }
    }
  },
  plugins: []
};

export default config;

