# Setting up donations (Stripe and PayPal)

The donation page (`/soutenir/`) is ready. It only needs the payment links below. Create them, send them over, and they go into `src/config.json` under `"donate" → "links"`.

Until the links are in place, the form tells donors that online payment is not active yet and gives them the e-mail address. It never pretends to take money.

## After payment, send donors here

Both Stripe and PayPal ask where to send the donor after paying. Use this thank-you page:

- While testing: `https://drfvdev.github.io/ayitianavan-site/merci/`
- After launch: `https://<your domain>/merci/`

## Stripe (cards, Apple Pay, Google Pay)

In the Stripe Dashboard, go to **Payment Links → New**.

**1. One-time gift, any amount: 1 link**

- Product: "Don à Ayiti an Avan"
- Price: choose **"Customers choose what to pay"**, currency USD, suggested amount $25, minimum $1.
- After payment: "Don't show confirmation page", redirect to the thank-you page above.

**2. Monthly gifts: 4 links ($5, $10, $20, $50)**

Stripe does not let donors pick their own amount on a recurring payment link, so each monthly amount needs its own link.

- Product: "Don mensuel à Ayiti an Avan"
- Add four **recurring, monthly** prices: $5, $10, $20, $50.
- Make one payment link per price, each redirecting to the thank-you page.

**3. Yearly gifts: 4 links ($50, $100, $250, $500)**

Same as monthly, with **recurring, yearly** prices. Yearly is optional: if you skip it, donors who pick yearly by card see a message suggesting PayPal or another option.

Donors who pick a custom amount for a monthly or yearly gift are pointed to PayPal, which handles that.

Tip: make the links in Stripe's **test mode** first and try them with Stripe's test card `4242 4242 4242 4242`, then make the real ones.

## PayPal: 1 link

1. Go to `paypal.com/donate/buttons` (a PayPal Business account is needed).
2. Create a **Donate** button: organization name "Ayiti an Avan", currency USD, let donors choose the amount, and allow **monthly** donations.
3. Set the return page to the thank-you page above.
4. At the end, PayPal shows a link like `https://www.paypal.com/donate/?hosted_button_id=XXXXXXXX`. That link is the one to send.

## What to send

| Link | Where it goes in `src/config.json` |
|---|---|
| Stripe one-time | `"card": { "once": "…" }` |
| Stripe monthly $5, $10, $20, $50 | `"card": { "month": { "5": "…", "10": "…", "20": "…", "50": "…" } }` |
| Stripe yearly $50, $100, $250, $500 | `"card": { "year": { "50": "…", … } }` |
| PayPal | `"paypal": "…"` |

To change the suggested amounts, edit `"donate" → "amounts"` and make matching Stripe links.
