// Pulls every article, page, category, tag and author from the WordPress site,
// plus the latest YouTube videos, and saves them to src/data/ for the build step.
// Run: npm run fetch
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, stripTags } from './lib/text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/data');
const WP = (process.env.WP_URL || 'https://ayitianavan.com').replace(/\/$/, '');
const API = `${WP}/wp-json/wp/v2`;
const YT_CHANNEL = process.env.YT_HANDLE || '@ayitianavannews';
const UA = 'Mozilla/5.0 (compatible; AyitiAnAvanSiteBuilder/1.0; +https://github.com/drfvdev/ayitianavan-site)';

async function getJSON(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return { data: await res.json(), headers: res.headers };
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

async function getAll(endpoint, params = '') {
  const out = [];
  let page = 1, total = 1;
  do {
    const sep = endpoint.includes('?') ? '&' : '?';
    const { data, headers } = await getJSON(`${API}/${endpoint}${sep}per_page=100&page=${page}${params}`);
    out.push(...data);
    total = Number(headers.get('x-wp-totalpages') || 1);
    process.stdout.write(`  ${endpoint.split('?')[0]} page ${page}/${total}\r`);
    page++;
  } while (page <= total);
  process.stdout.write('\n');
  return out;
}

// The site's path for a WordPress URL, e.g. https://ayitianavan.com/catégorie/sport/ -> /catégorie/sport/
function wpPath(link) {
  try { return decodeURIComponent(new URL(link).pathname).normalize('NFC'); } catch { return '/'; }
}

function image(media) {
  if (!media || !media.source_url) return null;
  const sizes = (media.media_details && media.media_details.sizes) || {};
  const list = Object.values(sizes)
    .filter(s => s.source_url && s.width)
    .sort((a, b) => a.width - b.width);
  const srcset = [...new Map(list.map(s => [s.width, `${s.source_url} ${s.width}w`])).values()].join(', ');
  const pick = sizes.large || sizes.medium_large || sizes.full || { source_url: media.source_url };
  return {
    src: pick.source_url,
    full: media.source_url,
    srcset,
    width: (media.media_details && media.media_details.width) || null,
    height: (media.media_details && media.media_details.height) || null,
    alt: decode(media.alt_text || ''),
    caption: stripTags(decode((media.caption && media.caption.rendered) || '')).trim(),
  };
}

// Author display names that are email addresses must never be shown publicly.
function safeAuthor(name) {
  const n = decode(name || '').trim();
  if (!n || n.includes('@')) return 'La Rédaction';
  return n;
}

async function fetchVideos() {
  const seedFile = path.join(DATA, 'videos.seed.json');
  const seed = JSON.parse(await fs.readFile(seedFile, 'utf8').catch(() => '{"videos":[],"shorts":[]}'));
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'fr' };
  const grab = async (tab) => {
    const res = await fetch(`https://www.youtube.com/${YT_CHANNEL}/${tab}`, { headers });
    if (!res.ok) throw new Error(`YouTube ${tab}: HTTP ${res.status}`);
    return res.text();
  };
  const out = { videos: [], shorts: [], fetchedAt: new Date().toISOString() };
  try {
    const h = await grab('videos');
    const seen = new Set();
    for (const m of h.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      out.videos.push({ id: m[1], title: JSON.parse(`"${m[2]}"`) });
      if (out.videos.length >= 24) break;
    }
  } catch (e) { console.warn('  videos:', e.message); }
  try {
    const h = await grab('shorts');
    const seen = new Set();
    for (const m of h.matchAll(/"shortsLockupViewModel".*?"accessibilityText":"(.*?)".*?"videoId":"([\w-]{11})"/g)) {
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      const label = JSON.parse(`"${m[1]}"`).replace(/,\s*[\d\s,.]+\s*(vues|views).*$/i, '');
      out.shorts.push({ id: m[2], title: label });
      if (out.shorts.length >= 24) break;
    }
  } catch (e) { console.warn('  shorts:', e.message); }
  if (!out.videos.length) out.videos = seed.videos || [];
  if (!out.shorts.length) out.shorts = seed.shorts || [];
  return out;
}

async function main() {
  await fs.mkdir(DATA, { recursive: true });
  console.log(`Fetching from ${WP}`);

  const [rawPosts, rawPages, rawCats, rawTags, rawUsers] = await Promise.all([
    getAll('posts', '&_embed=author,wp:featuredmedia&orderby=date&order=desc'),
    getAll('pages', '&_embed=wp:featuredmedia'),
    getAll('categories'),
    getAll('tags'),
    getAll('users').catch(() => []),
  ]);

  const categories = rawCats.map(c => ({
    id: c.id, name: decode(c.name), slug: c.slug, parent: c.parent, count: c.count,
    path: wpPath(c.link), description: stripTags(decode(c.description || '')),
  }));
  const tags = rawTags.map(t => ({ id: t.id, name: decode(t.name), slug: t.slug, count: t.count, path: wpPath(t.link) }));
  const authors = rawUsers.map(u => ({ id: u.id, name: safeAuthor(u.name), slug: u.slug, path: wpPath(u.link), bio: stripTags(decode(u.description || '')).trim() }));

  const posts = rawPosts.map(p => {
    const emb = p._embedded || {};
    const media = (emb['wp:featuredmedia'] || [])[0];
    const author = (emb.author || [])[0];
    return {
      id: p.id,
      slug: decodeURIComponent(p.slug),
      path: wpPath(p.link),
      date: p.date_gmt + 'Z',
      modified: p.modified_gmt + 'Z',
      title: decode(stripTags(p.title.rendered)),
      excerpt: decode(stripTags(p.excerpt.rendered)).replace(/\s+/g, ' ').replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, '…').trim(),
      content: p.content.rendered,
      author: { id: p.author, name: safeAuthor(author && author.name), slug: author && author.slug },
      categories: p.categories,
      tags: p.tags,
      sticky: !!p.sticky,
      image: image(media),
    };
  });

  const pages = rawPages.map(p => ({
    id: p.id,
    slug: decodeURIComponent(p.slug),
    path: wpPath(p.link),
    title: decode(stripTags(p.title.rendered)),
    content: p.content.rendered,
    modified: p.modified_gmt + 'Z',
  }));

  const site = await getJSON(`${WP}/wp-json/`).then(r => r.data).catch(() => ({}));

  const wp = {
    fetchedAt: new Date().toISOString(),
    source: WP,
    site: { name: decode(site.name || 'AYITI AN AVAN'), description: decode(site.description || '') },
    posts, pages, categories, tags, authors,
  };
  await fs.writeFile(path.join(DATA, 'wp.json'), JSON.stringify(wp));
  console.log(`Saved ${posts.length} articles, ${pages.length} pages, ${categories.length} categories, ${tags.length} tags, ${authors.length} authors.`);

  const videos = await fetchVideos();
  await fs.writeFile(path.join(DATA, 'videos.json'), JSON.stringify(videos, null, 1));
  console.log(`Saved ${videos.videos.length} videos and ${videos.shorts.length} shorts.`);
}

main().catch(err => { console.error(err); process.exit(1); });
