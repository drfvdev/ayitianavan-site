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
  return `<div><a class="dt" href="${u(c.path)}">${esc(c.name)}</a>${k.length ? `<ul>${k.map(k => `<li><a href="${u(k.path)}">${esc(k.name)}</a></li>`).join('')}</ul>` : ''}</div>`;
}).join('') + `<div><span class="dt">Vidéo</span><ul><li><a href="${u('/direct/')}">Ayiti an Avan TV</a></li><li><a href="${u('/shorts/')}">Shorts</a></li></ul></div>`;

/* ---------- assets ---------- */
const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const css = await fs.readFile(path.join(SRC, 'styles.css'), 'utf8');
const js = await fs.readFile(path.join(SRC, 'app.js'), 'utf8');
const assets = { css: u(`/assets/site.css?v=${hash(css)}`), js: u(`/assets/app.js?v=${hash(js)}`) };

const ctx = { config, videos, u, abs, assets, preview: PREVIEW, buildDate, nav, drawer, footerPages, primaryCat, wpSource: wp.source };

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

const readingTime = (html) => Math.max(1, Math.round(html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

/* ======================================================
   HOME
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
  const under = take(posts, 2, true);
  const wire = posts.filter(p => p.id !== lead.id).slice(0, 9);
  // a varied pick: the newest story from each section not already on the page
  const picks = [];
  for (const n of nav) {
    const p = sectionPosts(n.category).find(p => !used.has(p.id) && !wire.includes(p));
    if (p) { picks.push(p); used.add(p.id); }
    if (picks.length >= 5) break;
  }
  // trending topics: most used tags in recent articles, topped up with the busiest sections
  const tagCount = new Map();
  for (const p of posts.slice(0, 60)) for (const t of p.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const trending = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => tagById.get(id)).filter(Boolean).slice(0, 7);
  if (trending.length < 5) {
    const catCount = new Map();
    for (const p of posts.slice(0, 40)) { const c = primaryCat(p); if (c) catCount.set(c, (catCount.get(c) || 0) + 1); }
    trending.push(...[...catCount.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 7 - trending.length));
  }

  const related = posts.filter(p => p.id !== lead.id && p.categories.some(c => lead.categories.includes(c)) && !used.has(p.id)).slice(0, 4);
  related.forEach(p => used.add(p.id));

  const today = T.dayKey(buildDate);
  let lastDay = null;
  const wireHtml = wire.map(p => {
    const d = T.dayKey(p.date);
    const head = d !== lastDay ? `<li class="day">${d === today ? "Aujourd'hui" : esc(T.dateLong(p.date))}</li>` : '';
    lastDay = d;
    return `${head}<li><time datetime="${p.date}">${T.time(p.date)}</time><a href="${u(p.path)}" class="hl">${esc(p.title)}</a></li>`;
  }).join('');

  const block = (slug, n = 3) => {
    const nv = navByCat.get(slug); const list = take(sectionPosts(slug), n);
    if (!list.length || !nv) return '';
    const [first, ...rest] = list;
    return `<section aria-labelledby="h-${slug}">
      <div class="sechead"><h2 id="h-${slug}"><a href="${u(nv.path)}">${esc(nv.label)}</a></h2><a href="${u(nv.path)}">Plus →</a></div>
      ${T.card(ctx, first, { excerpt: false, sizes: '(max-width:820px) 100vw, 33vw' })}
      <ul class="stack">${rest.map(p => `<li><a href="${u(p.path)}" class="hl">${esc(p.title)}</a><span class="meta">${T.timeTag(p.date)}</span></li>`).join('')}</ul>
    </section>`;
  };
  const rowSection = (slug, alt) => {
    const nv = navByCat.get(slug); const list = take(sectionPosts(slug), 4, true);
    if (list.length < 2 || !nv) return '';
    return `<section class="band${alt ? ' alt' : ''}" aria-labelledby="h-${slug}"><div class="wrap">
      <div class="sechead"><h2 id="h-${slug}"><a href="${u(nv.path)}">${esc(nv.label)}</a></h2><a href="${u(nv.path)}">Toute la rubrique →</a></div>
      <div class="grid4">${list.map(p => T.card(ctx, p)).join('')}</div>
    </div></section>`;
  };
  const featureSection = (slug) => {
    const nv = navByCat.get(slug); const list = take(sectionPosts(slug), 5, true);
    if (!list.length || !nv) return '';
    const [f, ...rest] = list;
    return `<section class="band alt" aria-labelledby="h-${slug}"><div class="wrap">
      <div class="sechead"><h2 id="h-${slug}"><a href="${u(nv.path)}">${esc(nv.label)}</a></h2><a href="${u(nv.path)}">Toute la rubrique →</a></div>
      <a class="feature" href="${u(f.path)}">${T.img(f.image, { sizes: '(max-width:820px) 100vw, 55vw' })}<div>${T.kicker(ctx, f)}<h3 class="hl">${esc(f.title)}</h3><p class="s">${esc(T.trim(f.excerpt, 260))}</p><p class="meta">${T.timeTag(f.date)} · ${esc(f.author.name)}</p></div></a>
      ${rest.length ? `<div class="grid4 mt">${rest.map(p => T.card(ctx, p)).join('')}</div>` : ''}
    </div></section>`;
  };

  const hs = config.homeSections;
  const live = config.liveTv;
  const body = `
  ${trending.length ? `<div class="trend" aria-label="Sujets du jour"><div class="wrap"><span class="lab">Sujets du jour</span>${trending.map(t => `<a href="${u(t.path)}">${esc(t.name)}</a>`).join('')}</div></div>` : ''}
  <div class="ticker" aria-label="Dernières nouvelles"><div class="wrap"><span class="lab">Dernière heure</span><div class="win"><div class="ticker-track">${posts.slice(0, 6).map(p => `<a href="${u(p.path)}"><b>${esc(T.dateShort(p.date))}</b>${esc(p.title)}</a>`).join('')}</div></div></div></div>

  <div class="wrap front">
    <aside class="col-wire" aria-labelledby="h-wire">
      <div class="colhead"><h2 id="h-wire">À la minute</h2><a href="${u('/actualites/')}">Tout voir</a></div>
      <ul class="wire">${wireHtml}</ul>
    </aside>

    <section class="col-lead" aria-label="À la une">
      <article class="lead">
        <a href="${u(lead.path)}">${T.img(lead.image, { eager: true, sizes: '(max-width:820px) 100vw, 60vw', cls: 'lead-ph' })}${T.kicker(ctx, lead)}<h1 class="hl">${esc(lead.title)}</h1></a>
        <p class="chapo">${esc(T.trim(lead.excerpt, 260))}</p>
        <p class="meta">Par ${esc(lead.author.name)} · ${T.timeTag(lead.date, 'long')} · Lecture ${readingTime(lead.content)} min</p>
        ${related.length ? `<ul class="related">${related.map(p => `<li><a href="${u(p.path)}" class="hl">${esc(p.title)}</a></li>`).join('')}</ul>` : ''}
      </article>
      <div class="under">${under.map(p => T.card(ctx, p, { sizes: '(max-width:820px) 100vw, 30vw' })).join('')}</div>
    </section>

    <aside class="col-side">
      <div>
        <div class="colhead"><h2>Ayiti an Avan TV</h2><a href="${u('/direct/')}">${live ? 'Plein écran' : 'Toutes les vidéos'}</a></div>
        <div class="tvmini">${T.player(ctx)}</div>
      </div>
      <div>
        <div class="colhead"><h2>À ne pas manquer</h2></div>
        <ol class="mostread">${picks.map(p => `<li><a href="${u(p.path)}"><span class="kicker">${esc((ctx.primaryCat(p) || {}).name || '')}</span><span class="hl">${esc(p.title)}</span></a></li>`).join('')}</ol>
      </div>
    </aside>
  </div>

  ${shortsList.length ? `<section class="band shortsband" aria-labelledby="h-shorts"><div class="wrap">
    <div class="sechead"><h2 id="h-shorts">Shorts</h2><a href="${u('/shorts/')}">Tous les shorts →</a></div>
    <div class="rail">${shortsList.slice(0, 12).map(T.shortCard).join('')}</div>
  </div></section>` : ''}

  <section class="band" aria-label="Rubriques"><div class="wrap"><div class="grid3">${hs.trio.map(s => block(s)).join('')}</div></div></section>

  ${videos.videos.length ? `<section class="tvband" aria-labelledby="h-tv"><div class="wrap">
    <div class="sechead"><h2 id="h-tv">Ayiti an Avan <i>TV</i></h2><a href="${u('/direct/')}">${live ? 'Regarder le direct →' : 'Toutes les vidéos →'}</a></div>
    <div class="vids">${videos.videos.slice(0, 4).map(T.videoCard).join('')}</div>
  </div></section>` : ''}

  ${featureSection(hs.feature)}
  ${hs.rows.map((s, i) => rowSection(s, i % 2 === 1)).join('')}
  <section class="band" aria-label="Plus de rubriques"><div class="wrap"><div class="grid3">${hs.trio2.map(s => block(s)).join('')}</div></div></section>

  <section class="band alt"><div class="wrap"><div class="follow">
    <div><h2>Suivez l'actualité d'Haïti partout</h2><p>Recevez nos articles et nos vidéos directement sur votre téléphone.</p></div>
    <div class="follow-links">
      <a href="${config.social.whatsapp}" rel="noopener">${T.icon.whatsapp}Chaîne WhatsApp</a>
      <a href="${config.social.telegram}" rel="noopener">${T.icon.telegram}Telegram</a>
      <a href="${config.social.youtube}" rel="noopener">${T.icon.youtube}YouTube</a>
      <a href="${config.social.facebook}" rel="noopener">${T.icon.facebook}Facebook</a>
    </div>
  </div></div></section>`;

  await page('/', {
    title: '', description: config.about, body, current: '/', bodyClass: 'home', lastmod: posts[0].modified,
    jsonld: { '@context': 'https://schema.org', '@type': 'NewsMediaOrganization', name: config.name, url: abs('/'), sameAs: Object.values(config.social) },
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
    const related = (cat ? postsInCats([cat.id]) : posts).filter(x => x.id !== p.id).slice(0, 4);
    const latest = posts.filter(x => x.id !== p.id && !related.includes(x)).slice(0, 5);
    const tags = p.tags.map(id => tagById.get(id)).filter(Boolean);
    const url = abs(p.path);
    const share = encodeURIComponent(url), shareT = encodeURIComponent(p.title);
    const crumbs = [];
    if (cat) {
      let c = cat; const chain = [];
      while (c) { chain.unshift(c); c = c.parent ? catById.get(c.parent) : null; }
      for (const c of chain) crumbs.push(`<a href="${u(c.path)}">${esc(c.name)}</a>`);
    }
    const capText = (p.image && p.image.caption) || caption;
    const body = `
    <div class="wrap article">
      <article data-pagefind-body>
        <div class="crumbs"><a href="${u('/')}">Accueil</a>${crumbs.map(c => `<span aria-hidden="true">›</span>${c}`).join('')}</div>
        <h1 data-pagefind-meta="title">${esc(p.title)}</h1>
        ${showChapo(p, html) ? `<p class="chapo">${esc(T.trim(p.excerpt, 300))}</p>` : ''}
        <div class="byline">
          <div class="who"><span class="avatar" aria-hidden="true">${esc(p.author.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><span><b>${p.author.slug ? `<a href="${u('/author/' + p.author.slug + '/')}">${esc(p.author.name)}</a>` : esc(p.author.name)}</b><span class="meta">Publié le ${T.dateTimeLong(p.date)}${p.modified.slice(0, 10) !== p.date.slice(0, 10) ? ` · Mis à jour le ${T.dateLong(p.modified)}` : ''} · Lecture ${readingTime(p.content)} min</span></span></div>
          <div class="share" aria-label="Partager">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener" aria-label="Partager sur Facebook">${T.icon.facebook}</a>
            <a href="https://wa.me/?text=${shareT}%20${share}" target="_blank" rel="noopener" aria-label="Partager sur WhatsApp">${T.icon.whatsapp}</a>
            <a href="https://x.com/intent/post?url=${share}&text=${shareT}" target="_blank" rel="noopener" aria-label="Partager sur X">${T.icon.x}</a>
            <a href="https://t.me/share/url?url=${share}&text=${shareT}" target="_blank" rel="noopener" aria-label="Partager sur Telegram">${T.icon.telegram}</a>
            <button type="button" data-copy="${esc(url)}" aria-label="Copier le lien">${T.icon.link}</button>
          </div>
        </div>
        ${p.image ? `<figure class="hero">${T.img(p.image, { eager: true, sizes: '(max-width:820px) 100vw, 800px' })}${capText ? `<figcaption>${esc(capText)}</figcaption>` : ''}</figure>` : ''}
        <div class="prose">${html}</div>
        ${tags.length ? `<div class="tags">${tags.map(t => `<a href="${u(t.path)}">${esc(t.name)}</a>`).join('')}</div>` : ''}
        <div class="follow-inline">Suivez ${esc(config.name)} sur <a href="${config.social.whatsapp}" rel="noopener">WhatsApp</a>, <a href="${config.social.telegram}" rel="noopener">Telegram</a> et <a href="${config.social.youtube}" rel="noopener">YouTube</a>.</div>
      </article>
      <aside>
        <div class="aside-sticky">
          <div><div class="colhead"><h2>Ayiti an Avan TV</h2><a href="${u('/direct/')}">Plus</a></div><div class="tvmini">${T.player(ctx)}</div></div>
          <div><div class="colhead"><h2>À la minute</h2></div>
            <ol class="mostread">${latest.map(x => `<li><a href="${u(x.path)}"><span class="kicker">${esc(T.dateShort(x.date))}</span><span class="hl">${esc(x.title)}</span></a></li>`).join('')}</ol></div>
        </div>
      </aside>
    </div>
    ${related.length ? `<section class="band alt" aria-labelledby="h-rel"><div class="wrap">
      <div class="sechead"><h2 id="h-rel">${cat ? `Plus en ${esc(cat.name)}` : 'À lire aussi'}</h2>${cat ? `<a href="${u(cat.path)}">Toute la rubrique →</a>` : ''}</div>
      <div class="grid4">${related.map(x => T.card(ctx, x)).join('')}</div></div></section>` : ''}`;

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
        publisher: { '@type': 'NewsMediaOrganization', name: config.name, url: abs('/') },
        articleSection: cat ? cat.name : undefined,
      },
    });
  }
}

/* ======================================================
   LISTINGS: categories, tags, authors, "actualités"
   ====================================================== */
async function listing(basePath, { title, kickerText, intro = '', list, current, description }) {
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  for (let n = 1; n <= pages; n++) {
    const slice = list.slice((n - 1) * PER_PAGE, n * PER_PAGE);
    const top = n === 1 ? slice.slice(0, 1) : [];
    const rest = n === 1 ? slice.slice(1) : slice;
    const body = `<div class="wrap listing">
      <header class="listhead">${kickerText ? `<span class="kicker">${esc(kickerText)}</span>` : ''}<h1>${esc(title)}</h1>${intro ? `<p>${esc(intro)}</p>` : ''}<p class="meta">${list.length} article${list.length > 1 ? 's' : ''}${n > 1 ? ` · page ${n} sur ${pages}` : ''}</p></header>
      ${top.map(p => `<a class="feature top" href="${u(p.path)}">${T.img(p.image, { eager: true, sizes: '(max-width:820px) 100vw, 55vw' })}<div>${T.kicker(ctx, p)}<h2 class="hl">${esc(p.title)}</h2><p class="s">${esc(T.trim(p.excerpt, 260))}</p><p class="meta">${T.timeTag(p.date)} · ${esc(p.author.name)}</p></div></a>`).join('')}
      <div class="rows">${rest.map(p => T.row(ctx, p)).join('')}</div>
      ${list.length ? '' : '<p class="empty">Aucun article pour le moment.</p>'}
      ${T.pager(ctx, basePath, n, pages)}
    </div>`;
    await page(n === 1 ? basePath : `${basePath}page/${n}/`, {
      title: n > 1 ? `${title} (page ${n})` : title, description: description || intro || `${title} : toute l'actualité sur ${config.name}.`,
      body, current, noSitemap: n > 1, lastmod: list[0] && list[0].modified, bodyClass: 'is-listing',
    });
  }
}

async function buildListings() {
  for (const c of wp.categories) {
    const list = postsInCats([c.id]);
    const parent = c.parent ? catById.get(c.parent) : null;
    const navItem = nav.find(n => n.ids.some(id => descendants(id).includes(c.id)));
    await listing(c.path, { title: c.name, kickerText: parent ? parent.name : 'Rubrique', intro: c.description, list, current: navItem && navItem.path });
  }
  for (const t of wp.tags) {
    const list = posts.filter(p => p.tags.includes(t.id));
    await listing(t.path, { title: t.name, kickerText: 'Sujet', list });
  }
  for (const a of wp.authors) {
    const list = posts.filter(p => p.author.id === a.id);
    if (!list.length) continue;
    await listing(a.path, { title: a.name, kickerText: 'Auteur', list });
  }
  for (const alias of config.listingAliases) {
    await listing(`/${alias}/`, { title: 'Toute l’actualité', kickerText: 'À la minute', list: posts });
  }
}

/* ======================================================
   STATIC PAGES (about, legal)
   ====================================================== */
async function buildPages() {
  for (const p of footerPages) {
    let html = cleanPage(p.content);
    // drop a heading that repeats the page title
    html = html.replace(/^\s*<h[23]>([^<]*)<\/h[23]>/, (m, t) => t.trim().toLowerCase() === p.title.trim().toLowerCase() ? '' : m);
    await page(p.path, {
      title: p.title, lastmod: p.modified,
      body: `<div class="wrap narrow listing"><header class="listhead"><h1>${esc(p.title)}</h1></header><div class="prose">${html}</div></div>`,
    });
  }
}

/* ======================================================
   TV, SHORTS, SEARCH, 404
   ====================================================== */
async function buildVideoPages() {
  const live = config.liveTv;
  const sched = config.schedule || [];
  await page('/direct/', {
    title: 'Ayiti an Avan TV', current: '/direct/', description: 'Regardez Ayiti an Avan TV : directs, journaux et vidéos.',
    body: `<div class="wrap livepage">
      <h1>${live ? '<span class="pill-live big"><span class="dot"></span>EN DIRECT</span>' : ''}Ayiti an Avan TV</h1>
      <p class="intro">${live ? 'Regardez la chaîne en continu : journaux, débats et émissions en kreyòl.' : 'Nos vidéos et émissions. Le direct sera diffusé ici dès son lancement.'}</p>
      <div class="tvgrid">
        <div>${T.player(ctx, { big: true })}</div>
        <div class="tvside">
          ${sched.length ? `<h3>Programme</h3><ul class="sched">${sched.map(s => `<li><time>${esc(s.time)}</time><span>${esc(s.title)}${s.desc ? `<small>${esc(s.desc)}</small>` : ''}</span></li>`).join('')}</ul>`
          : `<h3>Abonnez-vous</h3><p>Pour être prévenu de chaque nouvelle vidéo et du lancement du direct, abonnez-vous à la chaîne YouTube.</p><a class="btn-yt" href="${config.social.youtube}?sub_confirmation=1" rel="noopener">${T.icon.youtube}S'abonner sur YouTube</a>`}
        </div>
      </div>
      <div class="sechead mt" id="replays"><h2>Replays</h2><a href="${config.social.youtube}/videos" rel="noopener">Sur YouTube →</a></div>
      <div class="vids grid">${videos.videos.map(T.videoCard).join('')}</div>
    </div>`,
  });

  await page('/shorts/', {
    title: 'Shorts', current: '/shorts/', description: "L'actualité d'Haïti en vidéos courtes.",
    body: `<div class="wrap livepage">
      <h1>Shorts</h1>
      <p class="intro">L'actualité d'Haïti en vidéos courtes. Touchez une vidéo pour la regarder, puis faites défiler pour passer à la suivante.</p>
      <div class="shortgrid">${shortsList.map(T.shortCard).join('')}</div>
    </div>`,
  });

  await page('/recherche/', {
    title: 'Recherche', noSitemap: true, description: 'Rechercher un article.',
    extraHead: `<link rel="stylesheet" href="${u('/pagefind/pagefind-ui.css')}"><script src="${u('/pagefind/pagefind-ui.js')}" defer></script>`,
    body: `<div class="wrap narrow listing"><header class="listhead"><h1>Rechercher</h1><p>Parmi les ${posts.length} articles publiés depuis ${esc(T.dateLong(posts[posts.length - 1].date).replace(/^\d+\s/, ''))}.</p></header><div id="search" data-search></div></div>`,
  });

  await out('/404.html', T.layout(ctx, {
    title: 'Page introuvable', path: '/404.html',
    body: `<div class="wrap narrow listing"><header class="listhead"><span class="kicker">Erreur 404</span><h1>Cette page n'existe pas ou plus.</h1><p>Le lien est peut-être incomplet. Cherchez l'article ou revenez à l'accueil.</p></header>
      <form class="drawer-search" action="${u('/recherche/')}" role="search"><label for="nf-q" class="vh">Rechercher</label><input id="nf-q" name="q" type="search" placeholder="Rechercher un article"><button type="submit">Rechercher</button></form>
      <h2 class="colhead mt">Les derniers articles</h2><div class="rows">${posts.slice(0, 6).map(p => T.row(ctx, p)).join('')}</div></div>`,
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
  await out('/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0c1f5c"/><text x="32" y="38" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" fill="#fff">AA</text><rect x="12" y="44" width="40" height="8" fill="#d21034"/></svg>`);
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
await buildVideoPages();
await buildMeta();
console.log(`Built ${written} files in ${((Date.now() - t0) / 1000).toFixed(1)}s → dist/ (base ${BASE}${PREVIEW ? ', preview' : ''})`);
