module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#09070b",
        wine: "#261119",
        rosewood: "#3a1721",
        gold: "#d7b56d",
        champagne: "#f2dfb0",
        pearl: "#fff8e8"
      },
      boxShadow: {
        glow: "0 20px 70px rgba(215, 181, 109, 0.18)",
        glass: "0 18px 50px rgba(0, 0, 0, 0.28)"
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
