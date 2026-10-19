// Runs in <head> before the page paints.
(function () {
  var root = document.documentElement;
  try {
    // Saved theme choice; without one the site follows the system setting.
    var theme = localStorage.getItem('site_theme');
    if (theme === 'dark' || theme === 'light') root.classList.add(theme);

    // Saved language choice; only the resume exists in both languages.
    var lang = localStorage.getItem('site_lang');
    var path = location.pathname;
    var onRu = path === '/' || path === '/index.html';
    var onEn = path === '/en' || path === '/en/' || path === '/en/index.html';
    if (lang === 'en' && onRu) location.replace('/en/' + location.hash);
    else if (lang === 'ru' && onEn) location.replace('/' + location.hash);
  } catch (_) {}
})();
