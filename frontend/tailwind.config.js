/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: "#6366f1",
        light: {
          bg: "#ffffff",
          text: "#111827",
          card: "#f9fafb",
          border: "#e5e7eb",
          primary: "#7c3aed",
          secondary: "#6b7280",
          muted: "#6b7280",
        },
        dark: {
          bg: "#0f172a",
          surface: "#1e293b",
          card: "#1e293b",
          border: "#334155",
          text: "#f8fafc",
          primary: "#8b5cf6",
          secondary: "#cbd5e1",
          muted: "#a1a1aa",
        },
      },
    },
  },
  plugins: [],
};
