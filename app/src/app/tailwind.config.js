// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",  // if using App Router
    "./pages/**/*.{js,ts,jsx,tsx}", // if using Pages Router
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}", // if you put code in src/
  ],
  theme: {
    extend: {
      // your custom theme or plugin config
    },
  },
  plugins: [],
};
