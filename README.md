# The Globe

A premium, shareable 3D globe gift for the whole family.

## Korea family map zoom data notes

G003 keeps the Korea family map zoom fully static and client-side. The current
committed family-map overlay is `korea-official-static-family-boundaries-v2`: 17
first-level Korea regions plus Busan/Haeundae, Seoul/Mapo, and
Gyeongnam/Gimhae/Bonghwang family drilldowns. It is documented from official
public-data/VWorld legal-boundary metadata and simplified as a static SVG guide.
Do not add live map APIs, backend services, auth flows, runtime API keys, or
legal-boundary accuracy claims. The geometry lives in
`src/mapData/koreaFamilyBoundaries.json`, its provenance/source strategy lives in
`src/mapData/boundaryProvenance.json`, and the decorative globe border asset
lives in `src/mapData/worldCountryBorders.json`.

The static data contract is locked in `src/mapData/dataProvenance.json` and
validated by `npm run verify:data`: Korea boundary candidates are build-time
public-data/VWorld static snapshots or documented metadata only, expanded capitals must exceed the legacy 33-entry
list, TOP100 city data must contain exactly 100 contiguous ranked rows from
the Euromonitor Top 100 City Destinations 2018 source with ranking-date/license notes. The app does not include a runtime forecast layer or forecast API.

The household configuration is intended to stay in one static file. Accepted
family display names and the seven Naver Band link slots live in
`src/householdConfig.ts`: 한가네 본가 has two placeholder Band slots, 건희민하찬희네 has
three, 진주네 has one, and 은하네 has one. Replace each placeholder with an
`https://band.us/...` URL only after confirming the target Band post/page, and
keep empty slots inert rather than inventing links. The name gate is a light,
client-only family cue; it is not authentication and does not store names.

Korea must be handled as its own family-map destination, not by reusing the
existing Seoul city card. Existing city content should remain unchanged unless a
separate city-content task explicitly owns that edit.


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
verification gate. The app has no backend, login dependency, or required live API dependency.
On macOS with Google Chrome installed, run `npm run smoke:korea` to build and then exercise the exploration mode, globe auto-rotation, Korea same-stage morph, 17-region Korea map, Busan → Haeundae drilldown, family marker, removed forecast UI guard, and household name-gate path in headless Chrome.

## Shareable URL

Deploy this Vite app to any static host such as Vercel, Netlify, Cloudflare Pages, or GitHub Pages. The app is fully client-side and does not require login or live API keys.


## Current verification evidence

Latest local G006 gate evidence should include:

- `npm run verify` — TypeScript, static data/provenance validators, production build.
- `npm run smoke:korea` — production build plus headless Chrome smoke covering all-captals/TOP100 exploration, globe auto-rotation, Korea same-stage morph, 17-region official/static overlay, Haeundae drilldown, glowing household markers, removed forecast UI guard, and the 건희민하찬희네 name gate.
- `git diff --check` — whitespace/static diff hygiene.

The current production bundle emits Vite's large-chunk warning because Three.js and static globe/map data are bundled client-side. This is noted as a performance follow-up, not a functional failure.
