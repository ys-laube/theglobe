# Korea family map data

This directory owns the bounded static data/provenance slice for the Korea Family Map Zoom story.

## Committed geometry

`koreaFamilyBoundaries.json` is hand-authored, stylized, normalized overlay geometry. It is intentionally **not** copied from external GIS coordinates and is suitable only for decorative family-path navigation.

It is not legal, cadastral, survey, routing, emergency, or address data.

## Provenance strategy

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
- southkorea/southkorea-maps fallback reference: https://github.com/southkorea/southkorea-maps

## Runtime constraints preserved

- No live map API calls.
- No backend, auth, login, or secret key dependency.
- No route through the existing Seoul capital card.
- Existing city/capital content remains untouched.
