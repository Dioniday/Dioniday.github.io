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

// Image lightbox for case-study screenshots: click to open, click again for full size,
// arrows to move between images, Esc or a click outside to close.
(function () {
  var images = Array.prototype.slice.call(document.querySelectorAll('.shot img, img[data-zoomable]'));
  if (!images.length) return;
  var ru = document.documentElement.lang === 'ru';

  var dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', ru ? 'Просмотр изображения' : 'Image viewer');
  dialog.innerHTML =
    '<div class="lightbox-stage"><img alt=""></div>' +
    '<p class="lightbox-caption"></p>' +
    '<button type="button" class="lightbox-btn right-4 top-4" data-act="close" aria-label="' + (ru ? 'Закрыть' : 'Close') + '">✕</button>' +
    '<button type="button" class="lightbox-btn left-4 top-1/2 -translate-y-1/2" data-act="prev" aria-label="' + (ru ? 'Предыдущее' : 'Previous') + '">←</button>' +
    '<button type="button" class="lightbox-btn right-4 top-1/2 -translate-y-1/2" data-act="next" aria-label="' + (ru ? 'Следующее' : 'Next') + '">→</button>';
  document.body.appendChild(dialog);

  var stage = dialog.querySelector('.lightbox-stage');
  var big = stage.querySelector('img');
  var caption = dialog.querySelector('.lightbox-caption');
  var current = 0;

  function show(index) {
    current = (index + images.length) % images.length;
    var source = images[current];
    var figure = source.closest('figure');
    var figcaption = figure && (figure.querySelector('figcaption') || (figure.parentElement && figure.parentElement.querySelector('figcaption')));
    stage.classList.remove('is-zoomed');
    big.src = source.currentSrc || source.src;
    big.alt = source.alt;
    caption.textContent = figcaption ? figcaption.textContent : source.alt;
    dialog.querySelectorAll('[data-act="prev"], [data-act="next"]').forEach(function (b) {
      b.hidden = images.length < 2;
    });
  }

  images.forEach(function (img, index) {
    img.setAttribute('data-zoomable', '');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    function open() {
      show(index);
      if (typeof dialog.showModal === 'function') dialog.showModal();
    }
    img.addEventListener('click', open);
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // Click on the picture toggles fit-to-screen / actual size, keeping the clicked point in view.
  big.addEventListener('click', function (e) {
    e.stopPropagation();
    var rect = big.getBoundingClientRect();
    var fx = (e.clientX - rect.left) / rect.width;
    var fy = (e.clientY - rect.top) / rect.height;
    var zoomed = stage.classList.toggle('is-zoomed');
    if (zoomed) {
      stage.scrollLeft = fx * big.naturalWidth - stage.clientWidth / 2;
      stage.scrollTop = fy * big.naturalHeight - stage.clientHeight / 2;
    }
  });

  stage.addEventListener('click', function (e) {
    if (e.target === stage) dialog.close();
  });
  dialog.addEventListener('click', function (e) {
    var act = e.target.closest && e.target.closest('[data-act]');
    if (!act) return;
    var name = act.getAttribute('data-act');
    if (name === 'close') dialog.close();
    if (name === 'prev') show(current - 1);
    if (name === 'next') show(current + 1);
  });
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', function () {
    big.removeAttribute('src');
    if (images[current]) images[current].focus({ preventScroll: true });
  });
})();
