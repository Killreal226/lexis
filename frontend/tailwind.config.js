/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "InterDisplay",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        // Soft pastel system
        cream: {
          50: "#FCFBF8",
          100: "#F8F6F1",
        },
        ink: {
          900: "#1A1A22",
          800: "#262631",
          700: "#3A3A47",
          600: "#56566A",
          500: "#7A7A8C",
          400: "#A0A0AE",
          300: "#C9C9D2",
          200: "#E4E4EA",
          100: "#F1F1F4",
          50: "#F8F8FA",
        },
        lavender: {
          50: "#F6F3FF",
          100: "#EDE6FF",
          200: "#DDD0FF",
          300: "#C4B0FB",
          400: "#A78BFA",
          500: "#8B6CF0",
          600: "#7048DB",
        },
        peach: {
          100: "#FFEDD9",
          200: "#FFD9B0",
          300: "#FFC189",
          400: "#FFA75C",
        },
        mint: {
          100: "#DEF7EA",
          200: "#BFEFD3",
          300: "#92E2B6",
          400: "#5FCE92",
        },
        sky2: {
          100: "#E1F1FF",
          200: "#C0E2FE",
          300: "#92CEFB",
          400: "#5CB1F2",
        },
        rose2: {
          100: "#FFE3E8",
          200: "#FFC5D0",
          300: "#FFA0B2",
          400: "#FB7A92",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20, 20, 35, 0.04), 0 4px 16px rgba(20, 20, 35, 0.04)",
        lift: "0 2px 4px rgba(20, 20, 35, 0.06), 0 12px 32px rgba(20, 20, 35, 0.08)",
        glow: "0 0 0 1px rgba(167, 139, 250, 0.15), 0 8px 32px rgba(167, 139, 250, 0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "scale-in": "scale-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
