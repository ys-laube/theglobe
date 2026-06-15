# Static map and data provenance

This directory owns the bounded static data/provenance slice for the Korea family map and the G001 globe data contract.

## Canonical contract

`dataProvenance.json` is the current source-of-truth contract for static app data. It locks:

- **Korea boundaries**: the committed app asset is `korea-family-boundaries-stylized-v1`, backed by `boundaryProvenance.json`. Future official-derived geometry must come from a build-time snapshot such as `국토교통부_일별법정구역정보 SHP` or compatible VWorld legal-boundary downloads; never from live map APIs, GADM, or NC/ND census derivatives.
- **Capitals**: the next generated capital dataset must use a documented Wikidata Query Service static snapshot, must include source/query/extraction/license metadata, and must exceed the legacy 33 curated entries.
- **TOP100 cities**: the UI-facing ranked dataset must contain exactly 100 contiguous ranks. The locked fallback source is the public Mastercard Global Destination Cities Index 2019 report (`2019-09-04`, international overnight visitors metric). Partial Agoda posts and incomplete public previews are not enough for the exact-100 contract.
- **Weather**: the baseline is simulated/static weather ambience. Open-Meteo may be used only as an optional no-key, non-blocking live enhancement with visible `simulated`, `live`, or `unavailable` disclosure and graceful fallback.

`npm run verify:data` validates these provenance contracts before downstream UI work can rely on the datasets.

## Committed Korea geometry

`koreaFamilyBoundaries.json` is hand-authored, stylized, normalized overlay geometry. It is intentionally **not** copied from external GIS coordinates and is suitable only for decorative family-path navigation.

`worldCountryBorders.json` is the separate bundled Natural Earth 110m country-border extraction used for non-pickable decorative globe context. It is static app data, not a live service dependency.

It is not legal, cadastral, survey, routing, emergency, or address data.

## Boundary provenance strategy

`boundaryProvenance.json` records the permissive boundary-source strategy:

- committed geometry: project-owned stylized data;
- future world/country boundary candidate: Natural Earth Admin 0 boundary/country layers, which Natural Earth describes as public-domain map data;
- future Korea legal-boundary candidates: Korean public-data legal-boundary feeds or SHP snapshots, processed at build time into static simplified data;
- excluded: GADM and NC/ND census-boundary layers for this public/static app.

Sources reviewed during implementation:

- Natural Earth: https://www.naturalearthdata.com/
- Natural Earth 110m cultural vectors / Admin 0 boundary lines: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
- 국토교통부_일별법정구역정보: https://www.data.go.kr/data/15045881/fileData.do?recommendDataYn=Y
- 법정구역경계_시군구: https://www.data.go.kr/data/28846482/linkedData.do
- VWorld legal-boundary download surfaces: https://www.vworld.kr/dtmk/dtmk_ntads_s002.do
- Wikidata Query Service: https://query.wikidata.org/
- Mastercard Global Destination Cities Index 2019 report: https://www.mastercard.com/news/media/wexffu4b/gdci-global-report-final-1.pdf
- Open-Meteo docs/pricing/terms: https://open-meteo.com/en/docs, https://open-meteo.com/en/pricing, https://open-meteo.com/en/terms
- southkorea/southkorea-maps fallback reference: https://github.com/southkorea/southkorea-maps

## Verification

Run the data/provenance gate directly with:

```bash
npm run verify:data
```

The aggregate project gate `npm run verify` also runs this verifier before the production build, so provenance drift or removed npm wiring fails local verification.

## Runtime constraints preserved

- No live map API calls.
- No backend, auth, login, or secret key dependency.
- No route through the existing Seoul capital card.
- Existing city/capital content remains untouched.
- Weather is optional static fallback copy only; no required live weather API, backend, auth, or runtime key.
