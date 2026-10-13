// Runs in <head>: send the visitor to their saved language before the page paints.
(function () {
  try {
    var saved = localStorage.getItem('site_lang');
    var onEn = location.pathname === '/en' || location.pathname.indexOf('/en/') === 0;
    if (saved === 'en' && !onEn) location.replace('/en/');
    else if (saved === 'ru' && onEn) location.replace('/');
  } catch (_) {}
})();
