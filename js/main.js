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
