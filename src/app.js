// Ayiti an Avan — small page behaviours. No framework.
(function () {
  var BASE = '__BASE__';

  // Today's date in the top bar
  try {
    var d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Port-au-Prince' });
    var t = document.querySelector('[data-today]');
    if (t) t.textContent = d;
  } catch (e) {}

  // "il y a 3 h" for recent articles
  var now = Date.now();
  document.querySelectorAll('time[data-rel]').forEach(function (el) {
    var diff = (now - new Date(el.getAttribute('datetime')).getTime()) / 60000;
    if (diff < 0 || diff > 60 * 24) return;
    el.title = el.textContent;
    el.textContent = diff < 60 ? 'Il y a ' + Math.max(1, Math.round(diff)) + ' min' : 'Il y a ' + Math.round(diff / 60) + ' h';
  });


  // Sticky header: show the small logo and Donate button once the big masthead has scrolled away
  var sentinel = document.querySelector('.stick-sentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      document.body.classList.toggle('stuck', !es[0].isIntersecting);
    }).observe(sentinel);
  }

  // Donation bar at the bottom of the screen: after a few pages, until closed (then hidden for 7 days)
  var banner = document.querySelector('[data-banner]');
  if (banner) {
    var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
    var views = (+store.get('aa-views') || 0) + 1;
    store.set('aa-views', views);
    var closedAt = +store.get('aa-banner-closed') || 0;
    if (views > +banner.getAttribute('data-after') && Date.now() - closedAt > 7 * 864e5) {
      banner.hidden = false;
      document.body.style.paddingBottom = banner.offsetHeight + 'px';
    }
    banner.querySelector('[data-banner-close]').addEventListener('click', function () {
      banner.hidden = true;
      document.body.style.paddingBottom = '';
      store.set('aa-banner-closed', Date.now());
    });
  }

  // Donate form: frequency switches the amounts; submit goes to the configured payment page
  var form = document.querySelector('[data-donate]');
  if (form) {
    var links = {}; try { links = JSON.parse(form.getAttribute('data-links')) || {}; } catch (e) {}
    var cur = form.getAttribute('data-currency') === 'USD' ? '$' : '';
    var freqLabel = { once: '', month: ' par mois', year: ' par an' };
    var current = function () {
      var f = form.querySelector('input[name=freq]:checked').value;
      var sel = form.querySelector('input[name=amount-' + f + ']:checked');
      var amount = sel ? sel.value : '';
      if (amount === 'other') amount = (form.querySelector('input[name=other-' + f + ']').value || '').trim();
      return { freq: f, amount: amount, method: form.querySelector('input[name=method]:checked').value };
    };
    var update = function () {
      var c = current();
      form.querySelectorAll('[data-tiers]').forEach(function (t) { t.hidden = t.getAttribute('data-tiers') !== c.freq; });
      form.querySelectorAll('.other-amount').forEach(function (o) {
        var t = o.closest('[data-tiers]');
        var other = t.querySelector('input[value=other]');
        o.hidden = !(other && other.checked);
      });
      form.querySelector('[data-summary]').textContent = c.amount ? cur + c.amount + freqLabel[c.freq] : '';
    };
    form.addEventListener('change', update);
    form.addEventListener('input', update);
    update();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = current();
      var note = form.querySelector('[data-note]');
      if (!c.amount || !(+c.amount > 0)) { note.hidden = false; note.textContent = 'Choisissez ou saisissez un montant.'; return; }
      var url = links[c.method];
      if (!url) { note.hidden = false; return; }
      url = url.replace('{amount}', encodeURIComponent(c.amount)).replace('{freq}', c.freq);
      window.location.href = url;
    });
  }

  // Full menu
  var drawer = document.getElementById('drawer');
  var menuBtns = document.querySelectorAll('[data-menu]');
  menuBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = drawer.hidden;
      drawer.hidden = !open;
      menuBtns.forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
      if (open) {
        if (btn.closest('.mast-big')) drawer.scrollIntoView({ block: 'start' });
        var i = drawer.querySelector('input'); if (i) i.focus({ preventScroll: true });
      }
    });
  });

  // Copy link
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var url = b.getAttribute('data-copy');
    var done = function () { b.classList.add('ok'); b.setAttribute('aria-label', 'Lien copié'); setTimeout(function () { b.classList.remove('ok'); b.setAttribute('aria-label', 'Copier le lien'); }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copiez ce lien :', url); });
    else window.prompt('Copiez ce lien :', url);
  });

  // Video player: load YouTube only when the reader presses play
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.player .play');
    if (!btn) return;
    var p = btn.closest('.player');
    var f = document.createElement('iframe');
    f.src = p.getAttribute('data-src');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.title = 'Ayiti an Avan TV';
    p.appendChild(f);
    p.classList.add('on');
  });

  // Shorts viewer (vertical, swipe to the next one)
  var shorts = null, viewer, feed, items = [], lastFocus = null, io = null;
  function ytThumb(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function buildViewer() {
    viewer = document.createElement('div');
    viewer.className = 'viewer';
    viewer.hidden = true;
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Lecteur de shorts');
    viewer.innerHTML = '<button class="vclose">Fermer</button>' +
      '<div class="vstage"><div class="vfeed"></div><div class="vnav"><button data-step="-1" aria-label="Vidéo précédente">Préc.</button><button data-step="1" aria-label="Vidéo suivante">Suiv.</button></div></div>';
    document.body.appendChild(viewer);
    feed = viewer.querySelector('.vfeed');
    feed.innerHTML = shorts.map(function (s, i) {
      return '<section class="vitem' + (s.s ? ' is-short' : '') + '" data-i="' + i + '" data-id="' + s.id + '">' +
        '<img src="' + ytThumb(s.id) + '" alt="">' +
        '<div class="frame"><img src="' + ytThumb(s.id) + '" alt=""><button class="play" aria-label="Lire"><svg viewBox="0 0 24 24"><path d="M6 4l15 8-15 8z"/></svg></button></div>' +
        '<div class="vinfo"><h3>' + esc(s.t) + '</h3><a href="https://www.youtube.com/' + (s.s ? 'shorts/' : 'watch?v=') + s.id + '" target="_blank" rel="noopener">Voir sur YouTube</a></div>' +
        '</section>';
    }).join('');
    items = Array.prototype.slice.call(feed.querySelectorAll('.vitem'));
    viewer.querySelector('.vclose').addEventListener('click', close);
    viewer.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { step(+b.getAttribute('data-step')); }); });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) close(); });
    feed.addEventListener('click', function (e) { var p = e.target.closest('.play'); if (p) play(p.closest('.vitem'), true); });
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio > 0.6) play(en.target, false);
          else stop(en.target);
        });
      }, { root: feed, threshold: [0, 0.6, 1] });
      items.forEach(function (it) { io.observe(it); });
    }
  }
  function play(it, withSound) {
    if (viewer.hidden || it.querySelector('iframe')) return;
    var id = it.getAttribute('data-id');
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=' + id + (withSound ? '' : '&mute=1');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.title = 'Vidéo';
    it.querySelector('.frame').appendChild(f);
  }
  function stop(it) { var f = it.querySelector('iframe'); if (f) f.remove(); }
  function open(i) {
    lastFocus = document.activeElement;
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    feed.scrollTop = items[i].offsetTop;
    play(items[i], true);
    viewer.querySelector('.vclose').focus();
  }
  function close() {
    viewer.hidden = true;
    document.body.style.overflow = '';
    items.forEach(stop);
    if (lastFocus) lastFocus.focus();
  }
  function step(n) { feed.scrollBy({ top: n * feed.clientHeight, behavior: 'smooth' }); }
  document.addEventListener('keydown', function (e) {
    if (!viewer || viewer.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
  });
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-short]');
    if (!s) return;
    var i = +s.getAttribute('data-short');
    if (shorts) { open(i); return; }
    fetch(BASE + 'assets/shorts.json').then(function (r) { return r.json(); }).then(function (data) {
      shorts = data; buildViewer(); open(i);
    }).catch(function () { window.location.href = 'https://www.youtube.com/@ayitianavannews/shorts'; });
  });

  // Search page
  var search = document.querySelector('[data-search]');
  if (search) {
    var start = function () {
      if (!window.PagefindUI) return setTimeout(start, 100);
      var ui = new window.PagefindUI({ element: '#search', showImages: true, showSubResults: false, translations: { placeholder: 'Rechercher un article', zero_results: 'Aucun article trouvé pour « [SEARCH_TERM] »' } });
      var q = new URLSearchParams(location.search).get('q');
      if (q) ui.triggerSearch(q);
    };
    start();
  }
})();
