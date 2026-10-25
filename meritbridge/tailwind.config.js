/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // MeritBridge burgundy brand palette
        brand: {
          50:  "#fdf2f4",
          100: "#fbe8ec",
          200: "#f5d0da",
          300: "#ecabbb",
          400: "#e07a95",
          500: "#d14f70",
          600: "#be2f52",
          700: "#9e2040",  // primary accent — matches UI design
          800: "#7f1a33",
          900: "#6a192e",
          950: "#3d0917",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
