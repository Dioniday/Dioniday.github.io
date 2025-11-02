(function () {
  const btnId = 'lang-toggle';
  const enPrefix = '/en';
  const storageKey = 'site_lang';

  function isEnPath(path) {
    return path === enPrefix || path.startsWith(enPrefix + '/');
  }

  function counterpartPath(path) {
    if (isEnPath(path)) {
      const stripped = path.slice(enPrefix.length);
      return stripped ? stripped : '/';
    } else {
      return enPrefix + (path === '/' ? '/' : path);
    }
  }

  function updateButtonText(btn, path) {
    if (!btn) return;
    btn.textContent = isEnPath(path) ? 'RU' : 'EN';
  }

  function init() {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    updateButtonText(btn, window.location.pathname);

    btn.addEventListener('click', function () {
      const newPath = counterpartPath(window.location.pathname);
      try {
        localStorage.setItem(storageKey, isEnPath(newPath) ? 'en' : 'ru');
      } catch (_) {}
      window.location.pathname = newPath;
    });

    // Respect saved preference on initial load
    let saved = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch (_) {}

    if (saved === 'en' && !isEnPath(window.location.pathname)) {
      const to = counterpartPath(window.location.pathname);
      window.location.replace(to);
      return;
    }
    if (saved === 'ru' && isEnPath(window.location.pathname)) {
      const to = counterpartPath(window.location.pathname);
      window.location.replace(to);
      return;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
