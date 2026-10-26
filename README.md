# Ayiti an Avan — new website

The new Ayiti an Avan site. Journalists keep writing in WordPress exactly as before; this project reads the articles from WordPress and builds a fast site from them.

**Test address:** https://drfvdev.github.io/ayitianavan-site/
The old site (https://ayitianavan.com) is untouched and stays the official site until you decide to switch.

## How it works

1. `npm run fetch` pulls every article, page, category, tag and author from WordPress (`/wp-json/`), plus the latest YouTube videos.
2. `npm run build` turns them into plain HTML pages in `dist/`, at the **same addresses as the old site** (`/article-name/`, `/catégorie/sport/`, `/tag/…/`, `/author/…/`), and builds the search index.
3. GitHub Actions does both every 15 minutes and publishes the result. A new article in WordPress appears on the new site within about 15–20 minutes.

## Common changes (edit `src/config.json`)

| What | Where |
|---|---|
| Turn on the live TV badge and player | `"liveTv": true` (streams from the YouTube channel's live) |
| TV schedule | `"schedule": [{ "time": "18:00", "title": "Le Journal", "desc": "…" }]` |
| Menu sections | `"nav"` (uses WordPress category slugs) |
| Homepage sections | `"homeSections"` |
| Social links, e-mail, tagline | `"social"`, `"email"`, `"tagline"` |

Shorts: the site picks up YouTube Shorts from the channel automatically. Until the channel posts Shorts, it shows the latest videos instead.

## Going live (later)

- **Same name:** point `ayitianavan.com` to the new host, set `SITE_URL=https://ayitianavan.com`, `SITE_BASE=/`, `PREVIEW=0`. WordPress moves to a sub-address (for example `admin.ayitianavan.com`) for writing only.
- **New name:** same, with the new domain; add a permanent redirect from `ayitianavan.com/*` to `new-domain.com/*` so every old link keeps working.
- **Switch back:** point the domain back to Hostinger. Nothing on the WordPress side is changed by this project.

## Run it on your computer

```bash
npm install
npm run fetch
npm run dev
```

Then open http://localhost:4321.
