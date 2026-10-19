/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './en/index.html', './404.html', './dioniday_site_card/index.html', './js/**/*.js'],
  // Dark follows the system unless the visitor picked a theme: js/head.js puts
  // .light or .dark on <html> from the saved choice.
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not(.light, .light *) }', '&:is(.dark, .dark *)']],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
