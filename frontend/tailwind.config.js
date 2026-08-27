/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F4FAF4",
          100: "#E8F5E9",
          200: "#C8E6C9",
          300: "#A3D9A1",
          400: "#7ABA78",
          500: "#5A9E58",
          600: "#0A6847",
          700: "#085438",
          800: "#063F2A",
          900: "#042B1D",
        },
        accent: {
          50: "#F6FBF6",
          100: "#EAF5EA",
          200: "#D3EBD3",
          300: "#B8DFB8",
          400: "#99D199",
          500: "#7ABA78",
          600: "#5C9E5A",
          700: "#437841",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
