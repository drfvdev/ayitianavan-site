// HTML templates for every page type. Each function returns a string.
// Design rules live in DESIGN.md: no labels above headlines, no tracked capitals,
// no dot-joined meta strings, no arrows on links, no decorative dots.
import { esc } from './text.mjs';

const TZ = 'America/Port-au-Prince';
const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const fDay = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fDayNoYear = fmt({ day: 'numeric', month: 'long' });
const fWeekday = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit' });
const fKey = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
const fYear = fmt({ year: 'numeric' });

export const dateLong = (iso) => fDay.format(new Date(iso));
export const weekday = (iso) => fWeekday.format(new Date(iso));
export const time = (iso) => fTime.format(new Date(iso)).replace(':', 'h');
export const dayKey = (iso) => fKey.format(new Date(iso));
export const dateTimeLong = (iso) => `${dateLong(iso)} à ${time(iso)}`;
// "2 septembre" this year, "2 septembre 2025" otherwise
export const dateShort = (iso, now = new Date()) =>
  fYear.format(new Date(iso)) === fYear.format(now) ? fDayNoYear.format(new Date(iso)) : fDay.format(new Date(iso));

/* ---------- icons (one stroke family, 24px grid) ---------- */
export const icon = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.2V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.3 18.6 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.2L6 13.6 1.1 12c-1.1-.3-1.1-1.1.2-1.6L20.5 3c.9-.3 1.7.2 1.4 1.3z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true" class="stroke"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true" class="stroke"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true" class="stroke"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
};

/* ---------- building blocks ---------- */
export function img(image, { sizes = '100vw', eager = false, cls = '' } = {}) {
  if (!image) return '';
  return `<figure class="ph ${cls}"><img src="${esc(image.src)}"${image.srcset ? ` srcset="${esc(image.srcset)}" sizes="${sizes}"` : ''} alt="${esc(image.alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${image.width ? ` width="${image.width}" height="${image.height}"` : ''}></figure>`;
}

// Section name and date under a headline: "Sécurité, 25 août"
export function meta(ctx, p, { section = true, author = false } = {}) {
  const c = section ? ctx.primaryCat(p) : null;
  const parts = [];
  if (c) parts.push(`<span class="sec">${esc(c.name)}</span>`);
  parts.push(`<time datetime="${p.date}" data-rel>${dateShort(p.date, new Date(ctx.buildDate))}</time>`);
  return `<p class="meta">${parts.join(', ')}${author ? `<span class="by">Par ${esc(p.author.name)}</span>` : ''}</p>`;
}

// Story with picture above the headline
export function story(ctx, p, { sizes = '(max-width:700px) 100vw, 33vw', standfirst = false, eager = false, cls = '' } = {}) {
  return `<article class="story ${cls}"><a href="${ctx.u(p.path)}">${img(p.image, { sizes, eager })}<h3 class="hl">${esc(p.title)}</h3></a>${standfirst && p.excerpt ? `<p class="sf">${esc(trim(p.excerpt, 170))}</p>` : ''}${meta(ctx, p)}</article>`;
}

// Headline only
export function line(ctx, p, { section = true } = {}) {
  return `<li><a href="${ctx.u(p.path)}" class="hl">${esc(p.title)}</a>${meta(ctx, p, { section })}</li>`;
}

// Listing row: picture left, text right
export function row(ctx, p) {
  return `<article class="row"><a href="${ctx.u(p.path)}">${img(p.image, { sizes: '(max-width:700px) 32vw, 240px' })}<div><h3 class="hl">${esc(p.title)}</h3><p class="sf">${esc(trim(p.excerpt, 200))}</p>${meta(ctx, p, { author: true })}</div></a></article>`;
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
  return `<nav class="pager" aria-label="Pages">
    ${page > 1 ? `<a href="${href(page - 1)}" rel="prev">Page précédente</a>` : '<span></span>'}
    <span class="nums">${nums.map(n => n === '…' ? '<span class="gap">…</span>' : n === page ? `<span aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`).join('')}</span>
    ${page < total ? `<a href="${href(page + 1)}" rel="next">Page suivante</a>` : '<span></span>'}
  </nav>`;
}

// Section heading: the name links to the section; one quiet link on the right
export function sechead(ctx, label, path, more = 'Toute la rubrique') {
  return `<header class="sechead"><h2><a href="${ctx.u(path)}">${esc(label)}</a></h2>${more ? `<a class="more" href="${ctx.u(path)}">${esc(more)}</a>` : ''}</header>`;
}

export function ytThumb(id, q = 'hqdefault') { return `https://i.ytimg.com/vi/${id}/${q}.jpg`; }

export function shortCard(v, i) {
  return `<li><button class="short" data-short="${i}"><span class="frame"><img src="${ytThumb(v.id, 'hqdefault')}" alt="" loading="lazy"><span class="pl">${icon.play}</span></span><span class="t">${esc(trim(v.title, 80))}</span></button></li>`;
}

export function videoRow(v) {
  return `<li><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="frame"><img src="${ytThumb(v.id, 'mqdefault')}" alt="" loading="lazy" width="320" height="180"></span><span class="t">${esc(trim(v.title, 100))}</span></a></li>`;
}

/* ---------- TV player: loads YouTube only after a click ---------- */
export function player(ctx, { big = false } = {}) {
  const { config, videos } = ctx;
  const live = config.liveTv;
  const latest = videos.videos[0];
  const src = live
    ? `https://www.youtube.com/embed/live_stream?channel=${config.youtubeChannelId}&autoplay=1`
    : latest ? `https://www.youtube-nocookie.com/embed/${latest.id}?autoplay=1&rel=0` : '';
  if (!src) return '';
  const poster = latest ? ytThumb(latest.id, big ? 'maxresdefault' : 'hqdefault') : '';
  const caption = live ? 'Ayiti an Avan TV, en direct' : latest ? latest.title : '';
  return `<figure class="tv">
    <div class="player" data-src="${esc(src)}">
      ${poster ? `<img src="${poster}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${latest ? ytThumb(latest.id, 'hqdefault') : ''}'">` : ''}
      <button class="play" aria-label="Lire la vidéo">${icon.play}</button>
    </div>
    <figcaption>${live ? '<span class="live" role="status">En direct</span>' : ''}${esc(trim(caption, big ? 140 : 90))}</figcaption>
  </figure>`;
}

/* ---------- layout ---------- */
export function layout(ctx, { title, description = '', path = '/', image = null, body, type = 'website', jsonld = null, bodyClass = '', extraHead = '', current = '' }) {
  const { config, u, abs, assets, preview, buildDate } = ctx;
  const fullTitle = title ? `${title} | ${config.name}` : `${config.name}, ${config.tagline}`;
  const canonical = abs(path);
  const on = (p) => (current === p ? ' aria-current="page"' : '');
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
<meta property="og:image" content="${esc(image ? (image.full || image.src) : abs('/logo.png'))}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:site" content="@ayitianavannews">
<meta name="theme-color" content="#ffffff">
<meta name="color-scheme" content="light">
<link rel="icon" href="${u('/favicon.png')}" type="image/png">
<link rel="apple-touch-icon" href="${u('/favicon.png')}">
<link rel="alternate" type="application/rss+xml" title="${esc(config.name)}" href="${u('/feed.xml')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..500&family=Archivo:wght@400..700&display=swap">
<link rel="stylesheet" href="${assets.css}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${extraHead}
</head>
<body class="${bodyClass}">
<a class="skip" href="#contenu">Aller au contenu</a>
${preview ? `<p class="preview-bar">Version de test du nouveau site. Le site officiel reste <a href="${esc(ctx.wpSource)}">${esc(ctx.wpSource.replace(/^https?:\/\//, ''))}</a>.</p>` : ''}
<header class="masthead">
  <div class="wrap mast">
    <p class="dateline" data-today>${esc(weekday(buildDate))}</p>
    <a class="logo" href="${u('/')}"><img src="${u('/logo.png')}" alt="${esc(config.name)}" width="485" height="236"></a>
    <div class="tools">
      <a class="tool" href="${u('/recherche/')}">${icon.search}<span>Rechercher</span></a>
      <button class="tool" data-menu aria-expanded="false" aria-controls="drawer">${icon.menu}<span>Rubriques</span></button>
    </div>
  </div>
  <nav class="sections" aria-label="Rubriques">
    <div class="wrap"><ul>
      <li><a href="${u('/')}"${on('/')}>À la une</a></li>
      ${ctx.nav.map(n => `<li><a href="${u(n.path)}"${on(n.path)}>${esc(n.label)}</a></li>`).join('')}
      <li class="push"><a href="${u('/direct/')}"${on('/direct/')}>${config.liveTv ? '<span class="live">En direct</span>' : 'TV'}</a></li>
      <li><a href="${u('/shorts/')}"${on('/shorts/')}>Shorts</a></li>
    </ul></div>
  </nav>
  <div class="drawer" id="drawer" hidden>
    <div class="wrap">
      <form class="searchform" action="${u('/recherche/')}" role="search">
        <label for="drawer-q">Rechercher un article</label>
        <div><input id="drawer-q" name="q" type="search" autocomplete="off"><button type="submit">Rechercher</button></div>
      </form>
      <div class="drawer-cols">${ctx.drawer}</div>
    </div>
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="colophon">
  <div class="wrap">
    <div class="col-top">
      <a class="logo" href="${u('/')}"><img src="${u('/logo.png')}" alt="${esc(config.name)}" width="485" height="236" loading="lazy"></a>
      <p class="about">${esc(config.about)} <span class="tag">${esc(config.tagline)}</span></p>
    </div>
    <nav class="col-links" aria-label="Pied de page">
      <ul>${ctx.nav.map(n => `<li><a href="${u(n.path)}">${esc(n.label)}</a></li>`).join('')}</ul>
      <ul>
        ${ctx.footerPages.map(p => `<li><a href="${u(p.path)}">${esc(p.title)}</a></li>`).join('')}
        <li><a href="${u('/feed.xml')}">Flux RSS</a></li>
      </ul>
    </nav>
    <div class="col-contact">
      <p>Écrire à la rédaction : <span class="sel">${esc(config.email)}</span></p>
      <p class="follow">Suivre ${esc(config.name)} sur
        <a href="${s.whatsapp}" rel="noopener">WhatsApp</a>,
        <a href="${s.telegram}" rel="noopener">Telegram</a>,
        <a href="${s.youtube}" rel="noopener">YouTube</a>,
        <a href="${s.facebook}" rel="noopener">Facebook</a> et
        <a href="${s.x}" rel="noopener">X</a>.</p>
      <p class="small">© ${new Date(buildDate).getFullYear()} ${esc(config.name)}. Page mise à jour le ${esc(dateTimeLong(buildDate))}.</p>
    </div>
  </div>
</footer>
<script src="${assets.js}" defer></script>
</body>
</html>`;
}
