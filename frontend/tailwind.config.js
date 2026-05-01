/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        cyber: {
          bg:      "#0a0e1a",
          card:    "#111827",
          border:  "#1e2d45",
          accent:  "#3b82f6",
          glow:    "rgba(59,130,246,0.15)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "cyber-grid": "linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      backgroundSize: {
        "cyber-grid": "40px 40px",
      },
      boxShadow: {
        "neon-blue":   "0 0 20px rgba(59,130,246,0.3)",
        "neon-red":    "0 0 20px rgba(239,68,68,0.3)",
        "neon-green":  "0 0 20px rgba(16,185,129,0.3)",
        "neon-orange": "0 0 20px rgba(249,115,22,0.3)",
        "glow-sm":     "0 0 8px rgba(59,130,246,0.2)",
        "glow-md":     "0 0 16px rgba(59,130,246,0.25)",
        "card":        "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-in":    "slideIn 0.25s ease-out",
        "fade-in":     "fadeIn 0.2s ease-out",
        "glow-pulse":  "pulseGlow 2s ease-in-out infinite",
        "scan":        "scanline 4s linear infinite",
      },
    },
  },
  plugins: [],
};
