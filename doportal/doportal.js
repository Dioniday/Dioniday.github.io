/* DoПортал — общий скрипт страниц (index, admin-guide) */
(function () {
  'use strict';

  /* ---------- Лайтбокс снимков: галерея, ← → , счётчик, focus-trap ---------- */
  var box = document.getElementById('zoom');
  if (box) {
    var imgEl = document.getElementById('zoom-img'),
        capEl = document.getElementById('zoom-cap'),
        cntEl = document.getElementById('zoom-count'),
        closeBtn = document.getElementById('zoom-close'),
        prevBtn = document.getElementById('zoom-prev'),
        nextBtn = document.getElementById('zoom-next'),
        shots = Array.prototype.slice.call(document.querySelectorAll('.shot img')),
        last = null, idx = -1;

    function render() {
      var src = shots[idx];
      imgEl.src = src.currentSrc || src.src;
      imgEl.alt = src.alt;
      var fig = src.closest('figure'), fc = fig && fig.querySelector('figcaption');
      capEl.textContent = fc ? fc.textContent : '';
      if (cntEl) cntEl.textContent = (idx + 1) + ' / ' + shots.length;
      var many = shots.length > 1;
      prevBtn.hidden = nextBtn.hidden = !many;
      box.scrollTop = 0;
    }
    function open(i) {
      idx = i; last = shots[i];
      render();
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function move(d) { if (shots.length > 1) { idx = (idx + d + shots.length) % shots.length; render(); } }
    function close() {
      box.hidden = true;
      document.body.style.overflow = '';
      if (last) last.focus();
    }

    var tipId = 'zoom-hint';
    var tip = document.createElement('span'); tip.id = tipId; tip.hidden = true;
    tip.textContent = 'Нажмите, чтобы увеличить'; document.body.appendChild(tip);
    shots.forEach(function (el, i) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-describedby', tipId);
      el.addEventListener('click', function () { open(i); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); move(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); move(1); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { move(-1); return; }
      if (e.key === 'ArrowRight') { move(1); return; }
      if (e.key === 'Tab') {
        var f = [closeBtn, prevBtn, nextBtn].filter(function (b) { return !b.hidden; });
        var cur = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(cur + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }

  /* ---------- Оглавление: активный раздел при прокрутке ---------- */
  var nav = document.querySelector('.toc-nav');
  if (nav) {
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[en.target.id];
          if (a) { a.setAttribute('aria-current', 'true'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('section.chapter[id]').forEach(function (sec) { obs.observe(sec); });
  }

  /* ---------- Кнопка «наверх» + индикатор прогресса чтения ---------- */
  var btn = document.getElementById('to-top');
  var bar = document.getElementById('read-progress');
  if (btn || bar) {
    var onScroll = function () {
      if (btn) btn.classList.toggle('show', window.scrollY > 800);
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    if (btn) btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- Мягкое появление секций при прокрутке ---------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    var secs = Array.prototype.slice.call(document.querySelectorAll('main .chapter'));
    if (secs.length > 1) {
      secs.slice(1).forEach(function (s) { s.classList.add('reveal'); });
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' });
      secs.forEach(function (s) { ro.observe(s); });
    }
  }
})();
