# Ayiti an Avan — design rules

The site should read like a daily newspaper, not like a generated template. These rules come from two public design guides written to stop AI tools producing look-alike pages, [pbakaus/impeccable](https://github.com/pbakaus/impeccable) and [Nutlope/hallmark](https://github.com/Nutlope/hallmark), applied to a news site. Keep to them when changing anything.

## Direction

- A newspaper read on a phone in daylight. Light only.
- White paper, because the logo file has a white background and no transparent version exists. If a transparent or SVG logo is made later, the paper can be tinted.
- The real logo is used everywhere. Never redraw it in a font.

## Type

- **Source Serif 4** for headlines and article text (one family, its display and text cuts). Chosen by setting a real headline from the site in six serif faces side by side.
- **Archivo** for wayfinding only: navigation, dates, bylines, captions, buttons.
- Body text 19px on articles, 65–70 characters per line.
- Headings in sentence case. Never spaced-out capital letters anywhere.

## Colour

All colours are tokens at the top of `src/styles.css`.

- Ink is a navy-tinted black, never pure black.
- The logo's red marks only what is current: the section you are in, and a live broadcast. Nothing else is red.
- The TV section is the one dark surface, because it is a screen.

## Structure

- Rules, not boxes: a double rule under the masthead, a heavy rule over each section, hairlines between stories. No cards with shadows or rounded corners.
- Each homepage section uses a different composition (big story with a column of headlines, three columns, a row of three, headline briefs). Never the same card grid repeated.

## Never

- A label above a headline ("ÉDUCATION", "POLITIQUE"). The section name goes in the line under the headline, with the date.
- Facts joined with dots ("A · B · C"). Use a comma, or put them on separate lines.
- Arrows on links ("Plus →"). Name where the link goes.
- Decorative dots, pulsing dots, scrolling tickers, numbers on lists that are not a ranking.
- A "LIVE" badge when nothing is live. The red "En direct" only appears when `liveTv` is on in `src/config.json`.
- Invented numbers (viewers, readers) or fake success messages.
- Colours or fonts written outside the token block.
