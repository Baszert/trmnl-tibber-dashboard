# Tibber

Your [Tibber](https://tibber.com) energy data as a clear at-a-glance dashboard. Supports NL, DE, SE and NO.

<a href="https://trmnl.com/recipes/188591"><img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" /></a>

## Features
- Current price with today's low/high and a price chart for today and tomorrow
- Today's consumption and cost, and this month's totals
- Solar production and earnings (optional)

## Settings
- **API key:** from the [Tibber developer dashboard](https://developer.tibber.com/settings/access-token)
- **Solar panels:** show production and earnings cards
- **Location name** and all **card titles** (so you can use your own language)

Data from the Tibber GraphQL API.

### Develop locally

Templates and settings live in [`src/`](src/), ready for [trmnlp](https://github.com/usetrmnl/trmnlp):

```sh
gem install trmnl_preview
trmnlp serve
```

Questions or ideas? trmnl@achtnegen.nl or @Bastronautica on Discord.
