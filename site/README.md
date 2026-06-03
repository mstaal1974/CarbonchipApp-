# carbonchip.com.au — Marketing Website

A standalone, dependency-free static marketing site for **carbonchip.com.au**,
rebuilt from the Carbonchip site architecture brief. "Dark Industrial Tech"
aesthetic: deep charcoal (`#121212`), neon emerald accent (`#00E676`),
Inter + JetBrains Mono.

> Note: this is the **public marketing site**, distinct from the internal
> Forestry BI dashboard PWA in the repository root (which deploys to
> `app.carbonchip.com.au`).

## Pages (sitemap)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `index.html` | Hero + authority matrix, dual pillars, pyrolysis pipeline, science grid, B2B lead form |
| `/technology` | `technology.html` | Mobile pyrolysis, air-curtain specs, feedstock inquiry, TDS |
| `/carbon-credits` | `carbon-credits.html` | Puro.earth registry integration, institutional CDR offtake |
| `/carbon-pots` | `carbon-pots.html` | `MaterialScienceToggle`, thermal/structural advantage, Brisbane manufacturing, bulk ordering |
| `/timber-products` | `timber-products.html` | `CommoditySpecGrid` + 3 procurement tabs, bulk trade account |

`/byproducts`, `/structural-sawn`, and `/roundwood` redirect into the
timber catalog (see `vercel.json`).

## Custom components (vanilla JS, in `assets/js/main.js`)

- **`MaterialScienceToggle`** (`[data-mst]`) — click a pot layer or chip to
  reveal PLA / PHA / Biochar chemistry.
- **`CommoditySpecGrid`** — dark macro-thumbnail grid with instant
  "Request Bulk Quote" triggers that deep-link into the trade-account form.
- **`OriginTrustBadge`** (`.origin-badge`) — Australian Made geometry with the
  93% local-trust metric.

Plus: sticky blur nav with mobile drawer, scroll-reveal, generic tab groups,
and demo lead-form handling with smart routing notes (Carbon Pots → Brisbane
engineering; timber → logistics).

## Run locally

```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080
```

(Use a server rather than `file://` so the absolute `/assets/...` paths resolve.)

## Deploy

Point a Vercel/Netlify project at the `site/` directory as its root/output.
`cleanUrls` maps `technology.html` → `/technology`. Then map the apex domain
`carbonchip.com.au` to it.

## Still placeholders / next steps

- Hero/media blocks use CSS-generated textures as stand-ins for the
  high-definition carbonizer video loop and macro biochar photography.
- Forms are client-side only (`console.log` demo). Wire to the B2B quoting
  engine (HubSpot/Salesforce custom flow) and PIM inventory API for live
  stock gating.
