/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#c79800",
        "accent-teal": "#00e6ac",
        "accent-rose": "#ff4d8d",
        "background-light": "#f8f8f5",
        "background-dark": "#0a0a0a",
        "surface-dark": "#121212",
        "border-dark": "#1f1f1f",
        "neutral-dark": "#121212",
        "accent-green": "#008f6a",
        "accent-red": "#b53d5a",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
