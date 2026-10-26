// HTML templates for every page type. Each function returns a string.
import { esc } from './text.mjs';

const TZ = 'America/Port-au-Prince';
const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const fDay = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fShort = fmt({ day: 'numeric', month: 'short' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit' });
const fKey = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });

export const dateLong = (iso) => fDay.format(new Date(iso));
export const dateShort = (iso) => fShort.format(new Date(iso));
export const time = (iso) => fTime.format(new Date(iso)).replace(':', 'h');
export const dayKey = (iso) => fKey.format(new Date(iso));
export const dateTimeLong = (iso) => `${dateLong(iso)} à ${time(iso)}`;

/* ---------- icons ---------- */
export const icon = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.2V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.3 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.2L6 13.6 1.1 12c-1.1-.3-1.1-1.1.2-1.6L20.5 3c.9-.3 1.7.2 1.4 1.3z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l15 8-15 8z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

export function wordmark(cls = '') {
  return `<span class="wordmark ${cls}"><span class="a">AYITI</span><span class="b">an avan</span></span>`;
}

/* ---------- building blocks ---------- */
export function img(image, { sizes = '100vw', eager = false, cls = '' } = {}) {
  if (!image) return `<div class="ph ph-empty ${cls}" aria-hidden="true">${wordmark('ph-mark')}</div>`;
  return `<div class="ph ${cls}"><img src="${esc(image.src)}"${image.srcset ? ` srcset="${esc(image.srcset)}" sizes="${sizes}"` : ''} alt="${esc(image.alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${image.width ? ` width="${image.width}" height="${image.height}"` : ''}></div>`;
}

export function kicker(ctx, post) {
  const c = ctx.primaryCat(post);
  return c ? `<span class="kicker">${esc(c.name)}</span>` : '';
}

export function timeTag(iso, mode = 'short') {
  const label = mode === 'long' ? dateTimeLong(iso) : dateShort(iso);
  return `<time datetime="${iso}" data-rel>${label}</time>`;
}

export function card(ctx, p, { sizes = '(max-width:560px) 120px, (max-width:1100px) 50vw, 25vw', excerpt = true } = {}) {
  return `<article class="card"><a href="${ctx.u(p.path)}">${img(p.image, { sizes })}<div class="card-body">${kicker(ctx, p)}<h3 class="hl">${esc(p.title)}</h3>${excerpt ? `<p class="s">${esc(trim(p.excerpt, 120))}</p>` : ''}<p class="meta">${timeTag(p.date)}</p></div></a></article>`;
}

export function row(ctx, p) {
  return `<article class="row"><a href="${ctx.u(p.path)}">${img(p.image, { sizes: '(max-width:700px) 34vw, 260px' })}<div>${kicker(ctx, p)}<h3 class="hl">${esc(p.title)}</h3><p class="s">${esc(trim(p.excerpt, 200))}</p><p class="meta">${timeTag(p.date)} · ${esc(p.author.name)}</p></div></a></article>`;
}

export function trim(s = '', n = 160) {
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

export function pager(ctx, base, page, total) {
  if (total <= 1) return '';
  const href = (n) => ctx.u(n === 1 ? base : `${base}page/${n}/`);
  const nums = [];
  for (let n = 1; n <= total; n++) {
    if (n === 1 || n === total || Math.abs(n - page) <= 2) nums.push(n);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return `<nav class="pager" aria-label="Pagination">
    ${page > 1 ? `<a href="${href(page - 1)}" rel="prev">← Précédent</a>` : '<span></span>'}
    <span class="nums">${nums.map(n => n === '…' ? '<span class="gap">…</span>' : n === page ? `<span aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`).join('')}</span>
    ${page < total ? `<a href="${href(page + 1)}" rel="next">Suivant →</a>` : '<span></span>'}
  </nav>`;
}

export function ytThumb(id, q = 'hqdefault') { return `https://i.ytimg.com/vi/${id}/${q}.jpg`; }

export function shortCard(v, i) {
  return `<button class="short" data-short="${i}" aria-label="Regarder : ${esc(v.title)}"><img src="${ytThumb(v.id, 'hqdefault')}" alt="" loading="lazy"><span class="top"><span class="cat">${v.isShort ? 'Short' : 'Vidéo'}</span></span><span class="bot"><span class="t">${esc(trim(v.title, 90))}</span></span></button>`;
}

export function videoCard(v) {
  return `<a class="vid" href="https://www.youtube.com/watch?v=${v.id}" data-yt="${v.id}" target="_blank" rel="noopener"><div class="ph">
    <img src="${ytThumb(v.id, 'mqdefault')}" alt="" loading="lazy" width="320" height="180"><span class="pl">${icon.play}</span></div>
    <h4>${esc(trim(v.title, 110))}</h4></a>`;
}

/* ---------- live / TV player ---------- */
export function player(ctx, { big = false, title = '' } = {}) {
  const { config, videos } = ctx;
  const live = config.liveTv;
  const latest = videos.videos[0];
  const src = live
    ? `https://www.youtube.com/embed/live_stream?channel=${config.youtubeChannelId}&autoplay=1`
    : latest ? `https://www.youtube-nocookie.com/embed/${latest.id}?autoplay=1&rel=0` : '';
  const poster = latest ? ytThumb(latest.id, big ? 'maxresdefault' : 'hqdefault') : '';
  const label = live ? 'En direct' : 'Dernière vidéo';
  const caption = title || (live ? 'Ayiti an Avan TV' : latest ? latest.title : '');
  if (!src) return '';
  return `<div class="player" data-src="${esc(src)}">
    ${poster ? `<img src="${poster}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${latest ? ytThumb(latest.id, 'hqdefault') : ''}'">` : ''}
    <div class="badge">${live ? `<span class="pill-live"><span class="dot"></span>EN DIRECT</span>` : `<span class="pill-tv">${label}</span>`}</div>
    <div class="bug">AYITI<span>an avan</span></div>
    <button class="play" aria-label="Lancer la vidéo">${icon.play}</button>
    <div class="lower"><b>${esc(trim(caption, big ? 120 : 70))}</b></div>
  </div>`;
}

/* ---------- layout ---------- */
export function layout(ctx, { title, description = '', path = '/', image = null, body, type = 'website', jsonld = null, bodyClass = '', extraHead = '', current = '' }) {
  const { config, u, abs, assets, preview, buildDate } = ctx;
  const fullTitle = title ? `${title} | ${config.name}` : `${config.name} | ${config.tagline}`;
  const canonical = abs(path);
  const navLinks = ctx.nav.map(n => `<a href="${u(n.path)}"${current === n.path ? ' class="on" aria-current="page"' : ''}>${esc(n.label)}</a>`).join('');
  const s = config.social;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(trim(description || config.about, 160))}">
<link rel="canonical" href="${canonical}">
${preview ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="max-image-preview:large">'}
<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title || config.name)}">
<meta property="og:description" content="${esc(trim(description || config.about, 200))}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${esc(image.full || image.src)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:site" content="@ayitianavannews">
<meta name="theme-color" content="#0c1f5c">
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.name)}" href="${u('/feed.xml')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..600&display=swap">
<link rel="stylesheet" href="${assets.css}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${extraHead}
</head>
<body class="${bodyClass}">
<a class="skip" href="#contenu">Aller au contenu</a>
${preview ? `<div class="preview-bar"><div class="wrap">Version de test du nouveau site. Le site officiel reste <a href="${esc(ctx.wpSource)}">${esc(ctx.wpSource.replace(/^https?:\/\//, ''))}</a>. Articles mis à jour automatiquement depuis WordPress.</div></div>` : ''}
<header class="site-header">
  <div class="util"><div class="wrap">
    <span class="today" data-today>${esc(dateLong(buildDate))}</span>
    <div class="soc">
      <a href="${s.facebook}" aria-label="Facebook" rel="noopener">${icon.facebook}</a>
      <a href="${s.x}" aria-label="X" rel="noopener">${icon.x}</a>
      <a href="${s.youtube}" aria-label="YouTube" rel="noopener">${icon.youtube}</a>
      <a href="${s.telegram}" aria-label="Telegram" rel="noopener">${icon.telegram}</a>
      <a href="${s.whatsapp}" aria-label="WhatsApp" rel="noopener">${icon.whatsapp}</a>
    </div>
  </div></div>
  <div class="mast"><div class="wrap">
    <div class="tools">
      <button class="iconbtn" data-menu aria-expanded="false" aria-controls="drawer" aria-label="Toutes les rubriques">${icon.menu}</button>
      <a class="iconbtn" href="${u('/recherche/')}" aria-label="Rechercher">${icon.search}</a>
    </div>
    <a class="logo" href="${u('/')}" aria-label="${esc(config.name)}, accueil">${wordmark()}<span class="tagline">${esc(config.tagline)}</span></a>
    <div class="cta">
      <a class="btn-live${config.liveTv ? ' on' : ''}" href="${u('/direct/')}">${config.liveTv ? '<span class="dot"></span>Direct' : `${icon.play}TV`}</a>
    </div>
  </div></div>
  <nav class="secnav" aria-label="Rubriques"><div class="wrap">
    <a href="${u('/')}"${current === '/' ? ' class="on" aria-current="page"' : ''}>À la une</a>
    ${navLinks}
    <span class="sep"></span>
    <a href="${u('/shorts/')}"${current === '/shorts/' ? ' class="on" aria-current="page"' : ''}>Shorts</a>
    <a href="${u('/direct/')}" class="tv${current === '/direct/' ? ' on' : ''}"><span class="d"></span>Ayiti an Avan TV</a>
  </div></nav>
  <div class="drawer" id="drawer" hidden>
    <div class="wrap">
      <form class="drawer-search" action="${u('/recherche/')}" role="search">
        <label for="drawer-q" class="vh">Rechercher un article</label>
        <input id="drawer-q" name="q" type="search" placeholder="Rechercher un article">
        <button type="submit">Rechercher</button>
      </form>
      <div class="drawer-cols">${ctx.drawer}</div>
    </div>
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="top">
      <div>
        ${wordmark()}
        <p class="about">${esc(config.about)}</p>
        <div class="soc big">
          <a href="${s.facebook}" aria-label="Facebook" rel="noopener">${icon.facebook}</a>
          <a href="${s.x}" aria-label="X" rel="noopener">${icon.x}</a>
          <a href="${s.youtube}" aria-label="YouTube" rel="noopener">${icon.youtube}</a>
          <a href="${s.telegram}" aria-label="Telegram" rel="noopener">${icon.telegram}</a>
          <a href="${s.whatsapp}" aria-label="WhatsApp" rel="noopener">${icon.whatsapp}</a>
        </div>
      </div>
      <div>
        <h4>Rubriques</h4>
        <ul class="cats">${ctx.nav.map(n => `<li><a href="${u(n.path)}">${esc(n.label)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>${esc(config.name)}</h4>
        <ul>
          ${ctx.footerPages.map(p => `<li><a href="${u(p.path)}">${esc(p.title)}</a></li>`).join('')}
          <li><a href="${u('/direct/')}">Ayiti an Avan TV</a></li>
          <li><a href="${u('/feed.xml')}">Flux RSS</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li class="sel">${esc(config.email)}</li>
          <li><a href="${s.whatsapp}" rel="noopener">Chaîne WhatsApp</a></li>
          <li><a href="${s.telegram}" rel="noopener">Chaîne Telegram</a></li>
        </ul>
      </div>
    </div>
    <div class="bottom">
      <span>© ${new Date(buildDate).getFullYear()} ${esc(config.name)}. Tous droits réservés.</span>
      <span>Mis à jour le ${esc(dateTimeLong(buildDate))}</span>
    </div>
  </div>
</footer>
<script src="${assets.js}" defer></script>
</body>
</html>`;
}
