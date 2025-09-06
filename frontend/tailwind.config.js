/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient-dark': 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
        'gradient-blue-purple': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-green-blue': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      },
    },
  },
  plugins: [],
}
