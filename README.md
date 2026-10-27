# Tibber

Your [Tibber](https://tibber.com) energy price as one clear curve. Supports NL, DE, SE and NO.

<a href="https://trmnl.com/recipes/188591"><img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" /></a>

## Features
- The price right now, with its Tibber level (very cheap to very expensive) and a short hint when it gets cheaper
- A curve of the 15-minute prices for the coming hours, including tomorrow once Tibber publishes it (around 13:00)
- The highest and lowest price marked on the curve, and a line where the day changes
- The cheapest and most expensive block ahead, both on the curve and as cards
- Tomorrow's price range in one line
- Today's usage and cost, this month's cost, and solar production (detected automatically)
- A clear message when the token is missing or Tibber has no prices yet

Works on TRMNL OG (1-bit) and TRMNL X, in landscape and portrait, in all four layouts (full, half horizontal, half vertical, quadrant).

## Settings
- **API key:** from the [Tibber developer dashboard](https://developer.tibber.com/settings/access-token)
- **Home number:** only needed if you have more than one Tibber home
- **Language:** Auto (your TRMNL account language), English, Nederlands, Deutsch, Svenska or Norsk
- **Price unit:** euro/krone (0.201) or cents (20.1 ct)
- **Cheapest block:** 1, 2, 3 or 4 hours

Data from the Tibber GraphQL API.

## How it works
- [`src/transform.js`](src/transform.js) turns the Tibber response into compact data: prices, the cheapest and priciest blocks, usage, cost and solar.
- [`src/shared.liquid`](src/shared.liquid) draws the screen as an SVG in the browser. It reads the screen size, orientation and bit depth from TRMNL's `.screen` classes, so one drawing routine covers every device and layout.
- The four layout files only call that routine.

### Develop locally

Templates and settings live in [`src/`](src/), ready for [trmnlp](https://github.com/usetrmnl/trmnlp):

```sh
gem install trmnl_preview
trmnlp serve
```

Questions or ideas? trmnl@achtnegen.nl or @Bastronautica on Discord.
