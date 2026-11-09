// Remember the language the visitor picked (read by /js/lang.js on the next visit).
document.querySelectorAll('[data-lang]').forEach(function (link) {
  link.addEventListener('click', function () {
    try {
      localStorage.setItem('site_lang', link.dataset.lang);
    } catch (_) {}
  });
});

// Light/dark toggle: flips whatever is showing now (saved choice or system) and remembers it.
document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
  button.addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.classList.contains('dark') ||
      (!root.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem('site_theme', next);
    } catch (_) {}
  });
});

// Portfolio videos: a clean poster with a big play button; native controls appear once playing.
document.querySelectorAll('video[data-cover]').forEach(function (video) {
  var label = document.documentElement.lang === 'ru' ? 'Смотреть: ' : 'Watch: ';
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'video-cover';
  button.setAttribute('aria-label', label + (video.getAttribute('aria-label') || ''));
  button.innerHTML = '<span class="video-cover-icon"><svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#play"></use></svg></span>';
  button.addEventListener('click', function () {
    video.controls = true;
    video.play();
    button.remove();
  });
  var wrapper = document.createElement('div');
  wrapper.className = 'relative';
  video.parentNode.insertBefore(wrapper, video);
  wrapper.append(video, button);
  video.controls = false;
});

// Only one portfolio video plays at a time.
var videos = document.querySelectorAll('video');
videos.forEach(function (video) {
  video.addEventListener('play', function () {
    videos.forEach(function (other) {
      if (other !== video) other.pause();
    });
  });
});

// Blocks fade in as they scroll into view (styles in tailwind.input.css).
(function () {
  var items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el) { observer.observe(el); });
})();

// Background showreel: no autoplay for visitors who asked for less motion.
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('video[data-ambient]').forEach(function (video) {
    video.removeAttribute('autoplay');
    video.pause();
  });
}

// Video tiles preview on hover.
document.querySelectorAll('[data-hover-play]').forEach(function (tile) {
  var video = tile.querySelector('video');
  if (!video) return;
  tile.addEventListener('mouseenter', function () { video.play().catch(function () {}); });
  tile.addEventListener('mouseleave', function () { video.pause(); });
});

// Full-size video player in a dialog (showreel, promo videos).
(function () {
  var dialog = document.getElementById('videoModal');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var player = dialog.querySelector('video');
  document.querySelectorAll('[data-video-src]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      player.src = trigger.getAttribute('data-video-src');
      player.poster = trigger.getAttribute('data-video-poster') || '';
      dialog.showModal();
      player.play().catch(function () {});
    });
  });
  function stop() {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  dialog.addEventListener('close', stop);
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
  var closeButton = dialog.querySelector('[data-close]');
  if (closeButton) closeButton.addEventListener('click', function () { dialog.close(); });
})();
