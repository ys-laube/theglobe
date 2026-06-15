# The Globe

A premium, shareable 3D globe gift for the whole family.

## Korea family map zoom data notes

G001 keeps the Korea family map zoom fully static and client-side. Boundary or
map-shape data must come from permissive local sources only: use bundled static
data with clear provenance notes, or simplified stylized geometry when a
production boundary source has not been approved. Do not add live map APIs,
backend services, auth flows, or runtime API keys. The current committed
family-map geometry lives in `src/mapData/koreaFamilyBoundaries.json`, its
provenance/source strategy lives in `src/mapData/boundaryProvenance.json`, and
the decorative globe border asset lives in `src/mapData/worldCountryBorders.json`.

The static data contract is locked in `src/mapData/dataProvenance.json` and
validated by `npm run verify:data`: Korea boundary candidates are build-time
public-data snapshots only, expanded capitals must exceed the legacy 33-entry
list, TOP100 city data must contain exactly 100 contiguous ranked rows from
the Euromonitor Top 100 City Destinations 2018 source with ranking-date/license notes, and weather starts as simulated/static with
only optional no-key Open-Meteo enhancement plus fallback disclosure.

The static data contract is locked in `src/mapData/dataProvenance.json` and
validated by `npm run verify:data`: Korea boundary candidates are build-time
public-data snapshots only, expanded capitals must exceed the legacy 33-entry
list, TOP100 city data must contain exactly 100 contiguous ranked rows from
the Euromonitor Top 100 City Destinations 2018 source with ranking-date/license notes, and weather starts as simulated/static with
only optional no-key Open-Meteo enhancement plus fallback disclosure.

The household configuration is intended to stay in one static file. Accepted
family display names and the seven Naver Band link slots live in
`src/householdConfig.ts`: 부모님네 has two placeholder Band slots, 누나네 has
three, 형네 has one, and 우리집 has one. Replace each placeholder with an
`https://band.us/...` URL only after confirming the target Band post/page, and
keep empty slots inert rather than inventing links. The name gate is a light,
client-only family cue; it is not authentication and does not store names.

Korea must be handled as its own family-map destination, not by reusing the
existing Seoul city card. Existing city content should remain unchanged unless a
separate city-content task explicitly owns that edit.

Weather remains optional for G001. The static policy in `src/weatherPolicy.ts`
allows only local fallback copy unless a future task explicitly approves a
permissive, optional provider path. Do not make weather a required live API,
backend, auth, or runtime-key dependency.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Verification notes

For full local verification, run:

```bash
npm run verify
```

This runs TypeScript checking, bundled boundary/provenance validation, and the
production Vite build. The boundary/provenance step is `npm run verify:data`; it
checks the static map JSON contracts, provenance exclusions, README provenance
notes, and that the aggregate `npm run verify` command still includes the data
verification gate. The app has no backend, login, or live API dependency.
On macOS with Google Chrome installed, run `npm run smoke:korea` after a build
to exercise the Korea → Busan → Haeundae → household name-gate path in headless
Chrome.

## Shareable URL

Deploy this Vite app to any static host such as Vercel, Netlify, Cloudflare Pages, or GitHub Pages. The app is fully client-side and does not require login or live API keys.
