/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-figtree)"],
        display: ["var(--font-playfair)"],
      },
      colors: {
        ink: {
          900: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
        },
        terracotta: {
          400: "#E2725B", // Standard terracotta color
        },
      },
    },
  },
  plugins: [],
};
