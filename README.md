# The Globe

A premium, shareable 3D globe gift for 건희, 민하, 찬희.

## Korea family map zoom data notes

G001 keeps the Korea family map zoom fully static and client-side. Boundary or
map-shape data must come from permissive local sources only: use bundled static
data with clear provenance notes, or simplified stylized geometry when a
production boundary source has not been approved. Do not add live map APIs,
backend services, auth flows, or runtime API keys.

The household configuration is intended to stay in one static file. Accepted
family display names are `건희`, `민하`, and `찬희`; any seven Naver Band links
should remain placeholders until the real share URLs are available. Replace each
placeholder with an `https://band.us/...` URL only after confirming the target
Band post/page, and keep empty slots inert rather than inventing links.

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

For G001 documentation/test evidence, run:

```bash
npm exec tsc -- --noEmit
npm run build
```

This project currently has no dedicated `test` or `lint` npm script, so the
build command is the available end-to-end static verification path.

## Shareable URL

Deploy this Vite app to any static host such as Vercel, Netlify, Cloudflare Pages, or GitHub Pages. The app is fully client-side and does not require login or live API keys.
