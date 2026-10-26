// Builds the whole site into dist/ from src/data/wp.json (made by `npm run fetch`).
//   SITE_URL   public address of the site, e.g. https://ayitianavan.com (used for canonical links)
//   SITE_BASE  sub-folder the site is served from, e.g. /ayitianavan-site/ on GitHub Pages ("/" by default)
//   PREVIEW=1  marks the site as a test version: adds a banner and tells search engines not to index it
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { esc, decode } from './lib/text.mjs';
import * as T from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const BASE = ('/' + (process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '') + '/').replace('//', '/');
const SITE_URL = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const PREVIEW = process.env.PREVIEW === '1';
const PER_PAGE = 24;

const readJSON = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const wp = await readJSON(path.join(SRC, 'data/wp.json'));
const videos = await readJSON(path.join(SRC, 'data/videos.json')).catch(() => readJSON(path.join(SRC, 'data/videos.seed.json')));
const config = await readJSON(path.join(SRC, 'config.json'));

const u = (p = '/') => BASE + String(p).replace(/^\/+/, '');
const abs = (p = '/') => SITE_URL + u(p);

/* ---------- indexes ---------- */
const posts = wp.posts.slice().sort((a, b) => b.date.localeCompare(a.date));
const catById = new Map(wp.categories.map(c => [c.id, c]));
const catBySlug = new Map(wp.categories.map(c => [c.slug, c]));
const tagById = new Map(wp.tags.map(t => [t.id, t]));
const children = new Map();
for (const c of wp.categories) {
  if (!children.has(c.parent)) children.set(c.parent, []);
  children.get(c.parent).push(c.id);
}
const descendants = (id) => [id, ...(children.get(id) || []).flatMap(descendants)];
const postsInCats = (ids) => {
  const set = new Set(ids.flatMap(descendants));
  return posts.filter(p => p.categories.some(c => set.has(c)));
};
const primaryCat = (p) => {
  const cats = p.categories.map(id => catById.get(id)).filter(c => c && c.slug !== 'news');
  return cats.find(c => c.parent) || cats[0] || null;
};

const nav = config.nav.map(n => {
  const c = catBySlug.get(n.category);
  const ids = [n.category, ...(n.also || [])].map(s => catBySlug.get(s)).filter(Boolean).map(c => c.id);
  return { ...n, path: c ? c.path : '/', ids, cat: c };
}).filter(n => n.cat);
const navByCat = new Map(nav.map(n => [n.category, n]));
const sectionPosts = (slug) => {
  const n = navByCat.get(slug);
  if (n) return postsInCats(n.ids);
  const c = catBySlug.get(slug);
  return c ? postsInCats([c.id]) : [];
};

const packages = (config.packages || []).map(pk => {
  const re = new RegExp(pk.match, 'i');
  return { ...pk, path: `/dossiers/${pk.slug}/`, posts: posts.filter(p => re.test(p.title)) };
}).filter(pk => pk.posts.length >= 4);
const authorById = new Map(wp.authors.map(a => [a.id, a]));

// Breaking-news bar: set in config, or a WordPress "sticky" post less than 48 hours old
const breaking = (() => {
  if (config.breaking && config.breaking.text) return { text: config.breaking.text, url: config.breaking.url || '#' };
  const s = posts.find(p => p.sticky && Date.now() - new Date(p.date).getTime() < 48 * 3600e3);
  return s ? { text: s.title, url: u(s.path) } : null;
})();

const footerPages = config.pages.map(s => wp.pages.find(p => p.slug === s)).filter(Boolean);

// shorts: real Shorts when the channel has them, otherwise the latest videos
const shortsList = (videos.shorts && videos.shorts.length ? videos.shorts.map(s => ({ ...s, isShort: true })) : videos.videos.map(v => ({ ...v, isShort: false }))).slice(0, 24);

const buildDate = new Date().toISOString();

/* ---------- drawer (full menu) ---------- */
const topCats = wp.categories.filter(c => c.parent === 0 && c.slug !== 'news')
  .map(c => ({ c, kids: (children.get(c.id) || []).map(id => catById.get(id)) }))
  .filter(({ c, kids }) => postsInCats([c.id]).length > 0)
  .sort((a, b) => a.c.name.localeCompare(b.c.name, 'fr'));
const drawer = topCats.map(({ c, kids }) => {
  const k = kids.filter(k => postsInCats([k.id]).length > 0);
  return `<div><h3><a href="${u(c.path)}">${esc(c.name)}</a></h3>${k.length ? `<ul>${k.map(k => `<li><a href="${u(k.path)}">${esc(k.name)}</a></li>`).join('')}</ul>` : ''}</div>`;
}).join('') + `<div><h3>Vidéo</h3><ul><li><a href="${u('/direct/')}">Ayiti an Avan TV</a></li><li><a href="${u('/shorts/')}">Shorts</a></li></ul></div>`
  + ((config.packages || []).length ? `<div><h3>Dossiers</h3><ul>${config.packages.map(pk => `<li><a href="${u('/dossiers/' + pk.slug + '/')}">${esc(pk.title)}</a></li>`).join('')}</ul></div>` : '');

/* ---------- assets ---------- */
const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const css = await fs.readFile(path.join(SRC, 'styles.css'), 'utf8');
const js = await fs.readFile(path.join(SRC, 'app.js'), 'utf8');
const assets = { css: u(`/assets/site.css?v=${hash(css)}`), js: u(`/assets/app.js?v=${hash(js)}`) };

const ctx = { config, videos, u, abs, assets, preview: PREVIEW, buildDate, nav, drawer, footerPages, primaryCat, wpSource: wp.source, breaking };

/* ---------- output helpers ---------- */
let written = 0;
async function out(routePath, html) {
  const rel = routePath.endsWith('/') ? routePath + 'index.html' : routePath;
  const file = path.join(DIST, rel.normalize('NFC'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
  written++;
}
const sitemap = [];
const page = async (routePath, opts) => {
  await out(routePath, T.layout(ctx, { path: routePath, ...opts }));
  if (!opts.noSitemap) sitemap.push({ loc: abs(routePath), lastmod: opts.lastmod });
};

/* ---------- article content clean-up ---------- */
const WP_HOST = new URL(wp.source).host.replace(/^www\./, '');
const stripSize = (src) => String(src).replace(/-\d+x\d+(?=\.\w+$)/, '').replace(/-scaled(?=\.\w+$)/, '');
function cleanContent(html, post) {
  let h = html;
  // WordPress "post author" blocks duplicate the byline
  h = h.replace(/<div class="wp-block-post-author">[\s\S]*?<\/p><\/div><\/div>/g, '');
  h = h.replace(/<div class="wp-block-post-author-name">[\s\S]*?<\/div>/g, '');
  // scripts are re-added once per page where needed (tweets)
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '');
  h = h.replace(/\sstyle="[^"]*"/gi, '');
  h = h.replace(/\sfetchpriority="[^"]*"/gi, '');
  h = h.replace(/<img(?![^>]*\sloading=)/gi, '<img loading="lazy"');
  // links to the old site point to the same page here
  h = h.replace(/href="https?:\/\/(?:www\.)?([^/"]+)(\/[^"]*)?"/g, (m, host, p = '/') => {
    if (host.replace(/^www\./, '') !== WP_HOST || p.startsWith('/wp-content/') || p.startsWith('/wp-admin')) return m;
    let decoded = p; try { decoded = decodeURI(p); } catch {}
    return `href="${u(decoded)}"`;
  });
  // remove the copy of the featured image inside the text
  let caption = '';
  if (post && post.image) {
    const target = stripSize(post.image.full);
    h = h.replace(/<figure class="wp-block-image[^"]*"[^>]*>[\s\S]*?<\/figure>/, (fig) => {
      const src = (fig.match(/src="([^"]+)"/) || [])[1];
      if (src && stripSize(src) === target) {
        caption = decode(((fig.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || '').replace(/<[^>]*>/g, '')).trim();
        return '';
      }
      return fig;
    });
  }
  // wrap tables so they scroll on phones
  h = h.replace(/<table/g, '<div class="tablewrap"><table').replace(/<\/table>/g, '</table></div>');
  return { html: h, caption };
}

// Elementor page markup -> plain article HTML
function cleanPage(html) {
  let h = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const allowed = new Set(['h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i', 'br', 'blockquote', 'figure', 'figcaption', 'img']);
  h = h.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!allowed.has(tag)) return '';
    if (m.startsWith('</')) return `</${tag}>`;
    const keep = [];
    for (const a of ['href', 'src', 'alt']) {
      const v = attrs.match(new RegExp(`\\s${a}=["']([^"']*)["']`, 'i'));
      if (v) keep.push(`${a}="${v[1]}"`);
    }
    return `<${tag}${keep.length ? ' ' + keep.join(' ') : ''}>`;
  });
  h = h.replace(/<(p|li|h\d)>\s*<\/\1>/g, '').replace(/\n\s*\n+/g, '\n');
  return h;
}

// WordPress makes the summary from the first paragraph when none is written; don't show it twice.
const norm = (s) => decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/[\s\u00a0]+/g, ' ').trim().toLowerCase();
const showChapo = (p, html) => p.excerpt && !norm(html).startsWith(norm(p.excerpt).replace(/…$/, '').slice(0, 80));

// Support prompt after the fourth paragraph, or at the end of short articles
function withPrompt(html) {
  let n = 0, done = false;
  const out = html.replace(/<\/p>/g, (m) => {
    n++;
    if (n === 4 && !done) { done = true; return m + T.supportPrompt(ctx); }
    return m;
  });
  return done ? out : out + T.supportPrompt(ctx);
}

function authorBio(p) {
  const a = authorById.get(p.author.id);
  if (!a || !a.bio) return '';
  return `<section class="author-bio" data-pagefind-ignore><h2>${esc(a.name)}</h2><p>${esc(a.bio)}</p><a class="more" href="${u(a.path)}">Tous ses articles</a></section>`;
}

const readingTime = (html) => Math.max(1, Math.round(html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

/* ======================================================
   HOME
   A newspaper front: the lead story and the running wire on the first
   screen, then sections that each take a different composition.
   ====================================================== */
async function buildHome() {
  const used = new Set();
  const take = (list, n, needImage = false) => {
    const outList = [];
    for (const p of list) {
      if (outList.length >= n) break;
      if (used.has(p.id) || (needImage && !p.image)) continue;
      used.add(p.id); outList.push(p);
    }
    return outList;
  };
  const [lead] = take(posts, 1, true);
  const seconds = take(posts, 2, true);
  const wire = posts.filter(p => p.id !== lead.id).slice(0, 8);

  const today = T.dayKey(buildDate);
  let lastDay = null;
  const wireHtml = wire.map(p => {
    const d = T.dayKey(p.date);
    const head = d !== lastDay ? `<li class="day"><h3>${d === today ? "Aujourd'hui" : esc(T.dateShort(p.date, new Date(buildDate)))}</h3></li>` : '';
    lastDay = d;
    return `${head}<li><time datetime="${p.date}">${T.time(p.date)}</time><a href="${u(p.path)}" class="hl">${esc(p.title)}</a></li>`;
  }).join('');

  const nv = (slug) => navByCat.get(slug);

  // Composition A: one big story with its standfirst, and a column of headlines
  const spread = (slug, { flip = false } = {}) => {
    const n = nv(slug); if (!n) return '';
    const [main] = take(sectionPosts(slug), 1, true);
    const rest = take(sectionPosts(slug), 4);
    if (!main) return '';
    return `<section class="band spread${flip ? ' flip' : ''}" aria-labelledby="s-${slug}"><div class="wrap">
      ${T.sechead(ctx, n.label, n.path).replace('<h2>', `<h2 id="s-${slug}">`)}
      <div class="spread-grid">
        <article class="story big"><a href="${u(main.path)}">${T.img(main.image, { sizes: '(max-width:820px) 100vw, 58vw' })}<h3 class="hl">${esc(main.title)}</h3></a><p class="sf">${esc(T.trim(main.excerpt, 240))}</p>${T.meta(ctx, main, { section: false, author: true })}</article>
        <ul class="lines">${rest.map(p => T.line(ctx, p, { section: false })).join('')}</ul>
      </div>
    </div></section>`;
  };

  // Composition B: three sections side by side, each a picture story and two headlines
  const columns = (slugs) => {
    const cols = slugs.map(slug => {
      const n = nv(slug); if (!n) return '';
      const [first] = take(sectionPosts(slug), 1, true);
      const rest = take(sectionPosts(slug), 2);
      if (!first) return '';
      return `<section aria-labelledby="s-${slug}">${T.sechead(ctx, n.label, n.path, '').replace('<h2>', `<h2 id="s-${slug}">`)}
        <article class="story"><a href="${u(first.path)}">${T.img(first.image, { sizes: '(max-width:820px) 100vw, 30vw' })}<h3 class="hl">${esc(first.title)}</h3></a>${T.meta(ctx, first, { section: false })}</article>
        <ul class="lines">${rest.map(p => T.line(ctx, p, { section: false })).join('')}</ul></section>`;
    }).join('');
    return `<div class="band"><div class="wrap columns">${cols}</div></div>`;
  };

  // Composition C: a row of three picture stories
  const strip = (slug) => {
    const n = nv(slug); if (!n) return '';
    const list = take(sectionPosts(slug), 3, true);
    if (list.length < 3) return '';
    return `<section class="band" aria-labelledby="s-${slug}"><div class="wrap">
      ${T.sechead(ctx, n.label, n.path).replace('<h2>', `<h2 id="s-${slug}">`)}
      <div class="strip">${list.map(p => T.story(ctx, p, { section: false })).join('')}</div>
    </div></section>`;
  };

  // Composition D: headlines only, two columns, like a newspaper's briefs
  const briefs = (slug) => {
    const n = nv(slug); if (!n) return '';
    const list = take(sectionPosts(slug), 6);
    if (list.length < 4) return '';
    return `<section class="band" aria-labelledby="s-${slug}"><div class="wrap">
      ${T.sechead(ctx, n.label, n.path).replace('<h2>', `<h2 id="s-${slug}">`)}
      <ul class="lines briefs">${list.map(p => T.line(ctx, p, { section: false })).join('')}</ul>
    </div></section>`;
  };

  const hs = config.homeSections;
  const vids = videos.videos;

  // Same day in earlier years ("Ce jour-là")
  // dayKey is "jj/mm/aaaa": compare day and month, skip this year
  const md = T.dayKey(buildDate).slice(0, 5), yr = T.dayKey(buildDate).slice(6);
  const onThisDay = posts.filter(p => T.dayKey(p.date).slice(0, 5) === md && T.dayKey(p.date).slice(6) !== yr).slice(0, 3);

  const pkg = packages[0];
  const packageBand = pkg ? (() => {
    const list = pkg.posts.filter(p => !used.has(p.id));
    const main = list.find(p => p.image); if (!main) return '';
    used.add(main.id);
    const rest = list.filter(p => p !== main).slice(0, 4); rest.forEach(p => used.add(p.id));
    return `<section class="band package" aria-labelledby="s-pkg"><div class="wrap">
      ${T.sechead(ctx, pkg.title, pkg.path, 'Tout le dossier').replace('<h2>', '<h2 id="s-pkg">')}
      <p class="pkg-intro">${esc(pkg.intro)}</p>
      <div class="spread-grid">
        <article class="story big"><a href="${u(main.path)}">${T.img(main.image, { sizes: '(max-width:820px) 100vw, 58vw' })}<h3 class="hl">${esc(main.title)}</h3></a><p class="sf">${esc(T.trim(main.excerpt, 220))}</p>${T.meta(ctx, main)}</article>
        <ul class="lines">${rest.map(p => T.line(ctx, p)).join('')}</ul>
      </div>
    </div></section>`;
  })() : '';

  const tips = config.tips || {};
  const tipsBand = `<section class="band tips" aria-labelledby="h-tips"><div class="wrap tips-grid">
    <h2 id="h-tips">Une info, une photo, une vidéo ? Envoyez-la à la rédaction.</h2>
    <div><p>Vous êtes témoin d'un événement en Haïti ou dans la diaspora ? Écrivez-nous. Nous vérifions chaque information avant de la publier, et nous protégeons nos sources.</p>
      <p class="tips-contact"><a href="mailto:${esc(tips.email || config.email)}">${esc(tips.email || config.email)}</a>${tips.whatsapp ? ` ou WhatsApp <a href="https://wa.me/${esc(tips.whatsapp.replace(/\D/g, ''))}">${esc(tips.whatsapp)}</a>` : ''}</p></div>
  </div></section>`;

  const liveBand = config.liveTv ? `<section class="liveband" aria-label="En direct"><div class="wrap"><div class="tv-grid">${T.player(ctx, { big: true })}<div><h2><span class="live">En direct</span> Ayiti an Avan TV</h2><p><a class="more" href="${u('/direct/')}">Programme et replays</a></p></div></div></div></section>` : '';
  const body = `
  ${liveBand}
  <div class="wrap front">
    <article class="lead">
      <a href="${u(lead.path)}">${T.img(lead.image, { eager: true, sizes: '(max-width:820px) 100vw, 64vw' })}<h1 class="hl">${esc(lead.title)}</h1></a>
      <p class="sf">${esc(T.trim(lead.excerpt, 240))}</p>
      ${T.meta(ctx, lead, { author: true })}
    </article>
    <aside class="wire" aria-labelledby="h-wire">
      <h2 id="h-wire"><a href="${u('/actualites/')}">En continu</a></h2>
      <ul>${wireHtml}</ul>
      <a class="more" href="${u('/actualites/')}">Toute l’actualité</a>
      ${onThisDay.length ? `<section class="otd" aria-labelledby="h-otd"><h2 id="h-otd">Ce jour-là</h2><ul>${onThisDay.map(p => `<li><time datetime="${p.date}">${esc(T.dateLong(p.date))}</time><a href="${u(p.path)}" class="hl">${esc(p.title)}</a></li>`).join('')}</ul></section>` : ''}
    </aside>
    <div class="seconds">${seconds.map(p => T.story(ctx, p, { standfirst: true, sizes: '(max-width:820px) 100vw, 30vw' })).join('')}</div>
  </div>

  ${spread(hs.trio[0])}
  ${packageBand}
  ${columns(hs.trio.slice(1).concat(hs.trio2[0]))}

  ${vids.length ? `<section class="tvband" aria-labelledby="h-tv"><div class="wrap">
    ${T.sechead(ctx, 'Ayiti an Avan TV', '/direct/', 'Toutes les vidéos').replace('<h2>', '<h2 id="h-tv">')}
    <div class="tv-grid">
      ${T.player(ctx, { big: true })}
      <ul class="videos">${vids.slice(1, 5).map(T.videoRow).join('')}</ul>
    </div>
    ${shortsList.length ? `<h3 class="shorts-h"><a href="${u('/shorts/')}">Shorts</a></h3><ul class="rail">${shortsList.slice(0, 10).map(T.shortCard).join('')}</ul>` : ''}
  </div></section>` : ''}

  ${spread(hs.feature, { flip: true })}
  ${strip(hs.rows[0])}
  ${briefs(hs.rows[1])}
  ${strip(hs.rows[2])}
  ${columns(hs.trio2.slice(1).concat(['diplomatie']))}
  ${tipsBand}
  `;

  await page('/', {
    title: '', description: config.about, body, current: '/', bodyClass: 'home', lastmod: posts[0].modified,
    jsonld: { '@context': 'https://schema.org', '@type': 'NewsMediaOrganization', name: config.name, url: abs('/'), logo: abs('/logo.png'), sameAs: Object.values(config.social) },
  });
}

/* ======================================================
   ARTICLES
   ====================================================== */
async function buildArticles() {
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const cat = primaryCat(p);
    const { html, caption } = cleanContent(p.content, p);
    const hasTweet = /class="twitter-tweet"/.test(html);
    const hasInsta = /instagram-media/.test(html);
    const related = (cat ? postsInCats([cat.id]) : posts).filter(x => x.id !== p.id).slice(0, 3);
    const latest = posts.filter(x => x.id !== p.id && !related.includes(x)).slice(0, 6);
    const tags = p.tags.map(id => tagById.get(id)).filter(Boolean);
    const url = abs(p.path);
    const share = encodeURIComponent(url), shareT = encodeURIComponent(p.title);
    const chain = [];
    for (let c = cat; c; c = c.parent ? catById.get(c.parent) : null) chain.unshift(c);
    const capText = (p.image && p.image.caption) || caption;
    const updated = p.modified.slice(0, 10) !== p.date.slice(0, 10);
    const body = `
    <div class="wrap article">
      <article class="story-page" data-pagefind-body>
        <nav class="crumbs" aria-label="Fil d'Ariane" data-pagefind-ignore><a href="${u('/')}">Accueil</a>${chain.map(c => `<span aria-hidden="true">/</span><a href="${u(c.path)}">${esc(c.name)}</a>`).join('')}</nav>
        <h1 data-pagefind-meta="title">${esc(p.title)}</h1>
        ${showChapo(p, html) ? `<p class="standfirst">${esc(T.trim(p.excerpt, 300))}</p>` : ''}
        <div class="byline" data-pagefind-ignore>
          <p><span class="by">Par ${p.author.slug ? `<a href="${u('/author/' + p.author.slug + '/')}">${esc(p.author.name)}</a>` : esc(p.author.name)}</span>
          <span>Publié le <time datetime="${p.date}">${T.dateTimeLong(p.date)}</time></span>
          ${updated ? `<span>Mis à jour le <time datetime="${p.modified}">${T.dateLong(p.modified)}</time></span>` : ''}</p>
          <div class="share" aria-label="Partager">
            <a href="https://wa.me/?text=${shareT}%20${share}" target="_blank" rel="noopener" aria-label="Partager sur WhatsApp">${T.icon.whatsapp}</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener" aria-label="Partager sur Facebook">${T.icon.facebook}</a>
            <a href="https://x.com/intent/post?url=${share}&text=${shareT}" target="_blank" rel="noopener" aria-label="Partager sur X">${T.icon.x}</a>
            <a href="https://t.me/share/url?url=${share}&text=${shareT}" target="_blank" rel="noopener" aria-label="Partager sur Telegram">${T.icon.telegram}</a>
            <button type="button" data-copy="${esc(url)}" aria-label="Copier le lien">${T.icon.link}</button>
          </div>
        </div>
        ${p.image ? `<figure class="hero"><img src="${esc(p.image.src)}"${p.image.srcset ? ` srcset="${esc(p.image.srcset)}" sizes="(max-width:820px) 100vw, 760px"` : ''} alt="${esc(p.image.alt)}" fetchpriority="high"${p.image.width ? ` width="${p.image.width}" height="${p.image.height}"` : ''}>${capText ? `<figcaption>${esc(capText)}</figcaption>` : ''}</figure>` : ''}
        <div class="prose">${withPrompt(html)}</div>
        ${tags.length ? `<p class="tags" data-pagefind-ignore>Sujets : ${tags.map(t => `<a href="${u(t.path)}">${esc(t.name)}</a>`).join(', ')}</p>` : ''}
        ${authorBio(p)}
        <p class="follow-note" data-pagefind-ignore>Recevez nos articles sur la <a href="${config.social.whatsapp}" rel="noopener">chaîne WhatsApp</a> ou sur <a href="${config.social.telegram}" rel="noopener">Telegram</a>.</p>
      </article>
      <aside class="article-aside">
        <section class="wire" aria-labelledby="h-latest"><h2 id="h-latest"><a href="${u('/actualites/')}">En continu</a></h2>
          <ul>${latest.map(x => `<li><time datetime="${x.date}">${esc(T.dateShort(x.date, new Date(buildDate)))}</time><a href="${u(x.path)}" class="hl">${esc(x.title)}</a></li>`).join('')}</ul>
        </section>
      </aside>
    </div>
    ${related.length ? `<section class="band related" aria-labelledby="h-rel"><div class="wrap">
      ${T.sechead(ctx, cat ? `Dans la rubrique ${cat.name}` : 'À lire aussi', cat ? cat.path : '/', cat ? 'Toute la rubrique' : '').replace('<h2>', '<h2 id="h-rel">')}
      <div class="strip">${related.map(x => T.story(ctx, x, { section: false })).join('')}</div></div></section>` : ''}`;

    await page(p.path, {
      title: p.title, description: p.excerpt, image: p.image, type: 'article', lastmod: p.modified, body, bodyClass: 'is-article',
      current: cat && nav.find(n => n.ids.some(id => descendants(id).includes(cat.id)))?.path,
      extraHead: `<meta property="article:published_time" content="${p.date}"><meta property="article:modified_time" content="${p.modified}">${cat ? `<meta property="article:section" content="${esc(cat.name)}">` : ''}`
        + (hasTweet ? '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>' : '')
        + (hasInsta ? '<script async src="https://www.instagram.com/embed.js"></script>' : ''),
      jsonld: {
        '@context': 'https://schema.org', '@type': 'NewsArticle', headline: p.title, description: p.excerpt,
        datePublished: p.date, dateModified: p.modified, mainEntityOfPage: url,
        image: p.image ? [p.image.full] : undefined,
        author: { '@type': 'Person', name: p.author.name },
        publisher: { '@type': 'NewsMediaOrganization', name: config.name, url: abs('/'), logo: { '@type': 'ImageObject', url: abs('/logo.png') } },
        articleSection: cat ? cat.name : undefined,
      },
    });
  }
}

/* ======================================================
   LISTINGS: categories, tags, authors, "actualités"
   ====================================================== */
async function listing(basePath, { title, intro = '', list, current, description, countLabel }) {
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  for (let n = 1; n <= pages; n++) {
    const slice = list.slice((n - 1) * PER_PAGE, n * PER_PAGE);
    const top = n === 1 ? slice.find(p => p.image) : null;
    const rest = slice.filter(p => p !== top);
    const count = `${list.length} ${countLabel || (list.length > 1 ? 'articles' : 'article')}${n > 1 ? `, page ${n} sur ${pages}` : ''}`;
    const body = `<div class="wrap listing">
      <header class="listhead"><h1>${esc(title)}</h1>${intro ? `<p class="intro">${esc(intro)}</p>` : ''}<p class="count">${count}</p></header>
      ${top ? `<article class="listing-top"><a href="${u(top.path)}" tabindex="-1" aria-hidden="true">${T.img(top.image, { eager: true, sizes: '(max-width:820px) 100vw, 60vw' })}</a><div><h2><a class="hl" href="${u(top.path)}">${esc(top.title)}</a></h2><p class="sf">${esc(T.trim(top.excerpt, 260))}</p>${T.meta(ctx, top, { author: true })}</div></article>` : ''}
      <div class="rows">${rest.map(p => T.row(ctx, p)).join('')}</div>
      ${list.length ? '' : '<p class="empty">Aucun article pour le moment.</p>'}
      ${T.pager(ctx, basePath, n, pages)}
    </div>`;
    await page(n === 1 ? basePath : `${basePath}page/${n}/`, {
      title: n > 1 ? `${title}, page ${n}` : title, description: description || intro || `${title} : toute l'actualité sur ${config.name}.`,
      body, current, noSitemap: n > 1, lastmod: list[0] && list[0].modified, bodyClass: 'is-listing',
    });
  }
}

async function buildListings() {
  for (const c of wp.categories) {
    const navItem = nav.find(n => n.ids.some(id => descendants(id).includes(c.id)));
    await listing(c.path, { title: c.name, intro: c.description, list: postsInCats([c.id]), current: navItem && navItem.path });
  }
  for (const t of wp.tags) {
    await listing(t.path, { title: t.name, list: posts.filter(p => p.tags.includes(t.id)), countLabel: undefined });
  }
  for (const a of wp.authors) {
    const list = posts.filter(p => p.author.id === a.id);
    if (!list.length) continue;
    await listing(a.path, { title: `Articles de ${a.name}`, list });
  }
  for (const pk of packages) {
    await listing(pk.path, { title: pk.title, intro: pk.intro, list: pk.posts });
  }
  for (const alias of config.listingAliases) {
    await listing(`/${alias}/`, { title: 'Toute l’actualité', list: posts });
  }
}

/* ======================================================
   STATIC PAGES (about, legal)
   ====================================================== */
async function buildPages() {
  for (const p of footerPages) {
    let html = cleanPage(p.content);
    html = html.replace(/^\s*<h[23]>([^<]*)<\/h[23]>/, (m, t) => t.trim().toLowerCase() === p.title.trim().toLowerCase() ? '' : m);
    await page(p.path, {
      title: p.title, lastmod: p.modified,
      body: `<div class="wrap narrow listing"><header class="listhead"><h1>${esc(p.title)}</h1></header><div class="prose plain">${html}</div></div>`,
    });
  }
}

/* ======================================================
   SUPPORT / DONATE (Newspack-style donate block)
   ====================================================== */
async function buildSupport() {
  const d = config.donate;
  const freq = [['once', 'Une fois'], ['month', 'Chaque mois'], ['year', 'Chaque année']];
  const cur = d.currency === 'USD' ? '$' : d.currency;
  const methods = [['card', 'Carte bancaire'], ['paypal', 'PayPal'], ['moncash', 'MonCash']];
  const configured = methods.filter(([k]) => d.links[k]);
  const tiers = (f) => d.amounts[f].map((a, i) => `<label class="tier"><input type="radio" name="amount-${f}" value="${a}"${a === d.default[f] ? ' checked' : ''}><span>${cur}${a}</span></label>`).join('');
  const body = `<div class="wrap support-page">
    <header class="listhead"><h1>Soutenez une information haïtienne indépendante</h1>
      <p class="intro">${esc(config.name)} n'appartient à aucun parti, à aucun homme d'affaires, à aucun gouvernement. Nous publions des informations vérifiées, en français et en kreyòl, pour Haïti et sa diaspora. Vos dons paient les reportages, la vérification et la future chaîne de télévision.</p></header>
    <div class="support-grid">
      <form class="donate-form" data-donate data-links='${esc(JSON.stringify(d.links))}' data-currency="${esc(d.currency)}">
        <fieldset class="freq"><legend>Fréquence</legend>
          ${freq.map(([k, l], i) => `<label><input type="radio" name="freq" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        ${freq.map(([k], i) => `<fieldset class="tiers" data-tiers="${k}"${i ? ' hidden' : ''}><legend>Montant${k === 'month' ? ' par mois' : k === 'year' ? ' par an' : ''}</legend>${tiers(k)}
          <label class="tier other"><input type="radio" name="amount-${k}" value="other"><span>Autre</span></label>
          <label class="other-amount" hidden><span>Montant en dollars</span><input type="number" min="1" step="1" inputmode="numeric" name="other-${k}"></label></fieldset>`).join('')}
        <fieldset class="methods"><legend>Payer avec</legend>
          ${methods.map(([k, l], i) => `<label><input type="radio" name="method" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <button type="submit" class="donate big">Donner <span data-summary></span></button>
        <p class="form-note" data-note${configured.length ? ' hidden' : ''}>${configured.length ? '' : `Le paiement en ligne sera activé dès que les comptes de paiement de la rédaction seront reliés au site. En attendant, écrivez à <a href="mailto:${esc(config.email)}">${esc(config.email)}</a> pour faire un don.`}</p>
      </form>
      <div class="support-why">
        <h2>Où va votre argent</h2>
        <ul class="lines">
          <li>Des journalistes sur le terrain, en Haïti, pour vérifier les faits avant de publier.</li>
          <li>Des articles gratuits pour tout le monde, sans mur payant.</li>
          <li>Ayiti an Avan TV : journaux, débats et émissions en kreyòl.</li>
        </ul>
        ${(d.otherWays || []).length ? `<h2>Autres façons de donner</h2><ul class="lines">${d.otherWays.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        <p class="small">Une question sur un don ? Écrivez à <span class="sel">${esc(config.email)}</span>.</p>
      </div>
    </div>
  </div>`;
  await page('/soutenir/', { title: 'Soutenir Ayiti an Avan', description: "Faites un don pour soutenir une information haïtienne indépendante.", body, bodyClass: 'is-support' });
}

/* ======================================================
   TV, SHORTS, SEARCH, 404
   ====================================================== */
async function buildVideoPages() {
  const live = config.liveTv;
  const sched = config.schedule || [];
  await page('/direct/', {
    title: 'Ayiti an Avan TV', current: '/direct/', description: 'Regardez Ayiti an Avan TV : directs, journaux et vidéos.',
    body: `<div class="wrap listing">
      <header class="listhead"><h1>Ayiti an Avan TV</h1><p class="intro">${live ? 'La chaîne en direct : journaux, débats et émissions en kreyòl.' : 'Nos vidéos et émissions, en kreyòl et en français. Le direct sera diffusé sur cette page dès son lancement.'}</p></header>
      <div class="tv-page">
        ${T.player(ctx, { big: true })}
        <div class="tv-side">
          ${sched.length ? `<h2>Programme</h2><ul class="sched">${sched.map(s => `<li><time>${esc(s.time)}</time><span>${esc(s.title)}${s.desc ? `<small>${esc(s.desc)}</small>` : ''}</span></li>`).join('')}</ul>`
          : `<h2>Ne manquez pas le lancement</h2><p>Abonnez-vous à la chaîne YouTube pour être prévenu de chaque nouvelle vidéo et du premier direct.</p><a class="button" href="${config.social.youtube}?sub_confirmation=1" rel="noopener">S’abonner sur YouTube</a>`}
        </div>
      </div>
      <section aria-labelledby="h-replays" id="replays">${T.sechead(ctx, 'Replays', '/direct/', '').replace('<h2>', '<h2 id="h-replays">')}
        <ul class="videos grid">${videos.videos.map(T.videoRow).join('')}</ul>
      </section>
    </div>`,
  });

  await page('/shorts/', {
    title: 'Shorts', current: '/shorts/', description: "L'actualité d'Haïti en vidéos courtes.",
    body: `<div class="wrap listing">
      <header class="listhead"><h1>Shorts</h1><p class="intro">L’actualité en vidéos courtes. Touchez une vidéo pour la lancer, puis faites défiler vers le haut pour passer à la suivante.</p></header>
      <ul class="shortgrid">${shortsList.map(T.shortCard).join('')}</ul>
    </div>`,
  });

  const since = T.dateLong(posts[posts.length - 1].date).replace(/^\d+\s/, '');
  await page('/recherche/', {
    title: 'Rechercher', noSitemap: true, description: 'Rechercher un article.',
    extraHead: `<link rel="stylesheet" href="${u('/pagefind/pagefind-ui.css')}"><script src="${u('/pagefind/pagefind-ui.js')}" defer></script>`,
    body: `<div class="wrap narrow listing"><header class="listhead"><h1>Rechercher</h1><p class="intro">Dans les ${posts.length} articles publiés depuis ${esc(since)}.</p></header><div id="search" data-search></div></div>`,
  });

  await out('/404.html', T.layout(ctx, {
    title: 'Page introuvable', path: '/404.html',
    body: `<div class="wrap narrow listing"><header class="listhead"><h1>Cette page n’existe pas ou plus</h1><p class="intro">Le lien est peut-être incomplet. Cherchez l’article, ou repartez des dernières nouvelles.</p></header>
      <form class="searchform" action="${u('/recherche/')}" role="search"><label for="nf-q">Rechercher un article</label><div><input id="nf-q" name="q" type="search"><button type="submit">Rechercher</button></div></form>
      <div class="rows">${posts.slice(0, 6).map(p => T.row(ctx, p)).join('')}</div></div>`,
  }));
}

/* ======================================================
   FEEDS, SITEMAP, ROBOTS, ASSETS
   ====================================================== */
async function buildMeta() {
  const xmlEsc = (s) => esc(s).replace(/'/g, '&apos;');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${xmlEsc(config.name)}</title><link>${abs('/')}</link><description>${xmlEsc(config.tagline)}</description><language>fr</language>
<atom:link href="${abs('/feed.xml')}" rel="self" type="application/rss+xml"/>
<lastBuildDate>${new Date(buildDate).toUTCString()}</lastBuildDate>
${posts.slice(0, 40).map(p => `<item><title>${xmlEsc(p.title)}</title><link>${abs(p.path)}</link><guid isPermaLink="true">${abs(p.path)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${xmlEsc(p.excerpt)}</description>${(primaryCat(p) ? `<category>${xmlEsc(primaryCat(p).name)}</category>` : '')}${p.image ? `<media:content url="${xmlEsc(p.image.full)}" medium="image"/>` : ''}</item>`).join('\n')}
</channel></rss>`;
  await out('/feed.xml', rss);

  const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map(s => `<url><loc>${xmlEsc(encodeURI(s.loc))}</loc>${s.lastmod ? `<lastmod>${s.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  await out('/sitemap.xml', sm);

  await out('/robots.txt', PREVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);

  await out('/assets/site.css', css);
  await out('/assets/app.js', js.replace('__BASE__', BASE));
  for (const f of await fs.readdir(path.join(ROOT, 'static'))) await out('/' + f, await fs.readFile(path.join(ROOT, 'static', f)));
  await out('/.nojekyll', '');
  const shortsData = shortsList.map(s => ({ id: s.id, t: s.title, s: s.isShort }));
  await out('/assets/shorts.json', JSON.stringify(shortsData));
}

/* ---------- run ---------- */
const t0 = Date.now();
await fs.rm(DIST, { recursive: true, force: true });
await buildHome();
await buildArticles();
await buildListings();
await buildPages();
await buildSupport();
await buildVideoPages();
await buildMeta();
console.log(`Built ${written} files in ${((Date.now() - t0) / 1000).toFixed(1)}s → dist/ (base ${BASE}${PREVIEW ? ', preview' : ''})`);
