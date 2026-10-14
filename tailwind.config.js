/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './en/index.html', './dioniday_site_card/index.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
