

/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        navy: "#0A1628",
        navyMid: "#112240",
        apsBlue: "#1565C0",
        apsBlueMid: "#1976D2",
        apsBlueLt: "#E3F0FF",
        apsTeal: "#00897B",
        apsTealLt: "#E0F2F1",
        apsAmber: "#F59E0B",
        apsAmberLt: "#FEF3C7",
        apsRed: "#EF4444",
        apsRedLt: "#FEE2E2",
        apsGreen: "#22C55E",
        apsGreenLt: "#DCFCE7",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

