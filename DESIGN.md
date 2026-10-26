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
- The logo's red marks what is current (the section you are in, a live broadcast, breaking news) and the one thing we ask of readers: the Donate button. Nothing else is red.
- The TV section is the one dark surface, because it is a screen.

## Structure

- Rules, not boxes: a double rule under the masthead, a heavy rule over each section, hairlines between stories. No cards with shadows or rounded corners.
- Each homepage section uses a different composition (big story with a column of headlines, three columns, a row of three, headline briefs). Never the same card grid repeated.

## Header

- The big masthead (date, logo, search, menu, Donate) scrolls away. The section bar stays pinned at the top and gains a small logo and the Donate button once the masthead is gone.
- On phones, a slim bar with the logo, Donate, search and menu stays pinned (like the NBC News app); the section strip hides while scrolling.

## Reader revenue (ideas taken from Newspack sites)

- Donate button in the header, the menu and the footer.
- A support box inside articles, after the fourth paragraph, ruled top and bottom, never a coloured card.
- A bar at the bottom of the screen from the third page a reader opens; "Plus tard" hides it for seven days.
- The donation page works like Newspack's donate block: frequency (once, monthly, yearly), amounts, payment method.
- Never fake a payment confirmation. Until a payment link is set in `src/config.json`, the form says so and gives the e-mail address.

## Changed after comparing with real news sites (26 October 2026)

Screenshots of NBC News, CHEK News, Haitian Times, Texas Tribune, CalMatters, The City and the Colorado Sun, set beside ours, showed the first version read like a quiet print page. Where the owner's references and the design guides disagree, the references win:

- Section labels above headlines are back (small, red, bold capitals), as on every reference site.
- Section titles are bold capitals with a red bar, like NBC's and CHEK's.
- A slim navy top bar (date, TV, Shorts, WhatsApp, social links) above the logo, like the Colorado Sun and Texas Tribune.
- A topics strip ("À suivre") under the menu, like NBC and Haitian Times.
- The front page has three columns, like NBC: lead story with related headlines, a column of stories, and TV above "En continu" on the right.

## Never

- Facts joined with dots ("A · B · C"). Use a comma, or put them on separate lines.
- Arrows on links ("Plus →"). Name where the link goes.
- Decorative dots, pulsing dots, scrolling tickers, numbers on lists that are not a ranking.
- A "LIVE" badge when nothing is live. The red "En direct" only appears when `liveTv` is on in `src/config.json`.
- Invented numbers (viewers, readers) or fake success messages.
- Colours or fonts written outside the token block.
