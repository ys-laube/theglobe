# Visual QA Evidence — Rebuild Premium Real-Earth Globe

Date: 2026-06-14 UTC  
Worker: worker-1  
Scope: OMX ultragoal G001 / team task 2

## Initial mode verdict
- Command: `node /tmp/globe-smoke.mjs` against `npm run dev -- --host 127.0.0.1 --port 4173`
- Result: PASS
- Evidence: Chrome CDP smoke reported `INITIAL {"ok":true,"state":"earth-ready", ... "count":"0","names":true}`.
- Visual/product verdict: initial mode reaches a real-Earth state with external Earth texture loaded, the globe remains dominant, names 건희, 민하, 찬희 are present, and visible capital count is `0` so dense markers/cards are not shown at launch.

## Exploration mode verdict
- Command: `node /tmp/globe-smoke.mjs` against `npm run dev -- --host 127.0.0.1 --port 4173`
- Result: PASS
- Evidence: Chrome CDP smoke reported `EXPLORATION {"ok":true,"state":"asset-enhancement-ready","count":"12","button":"탐험 모드 닫기"...}`.
- Visual/product verdict: after user action, exploration mode reveals curated highlight markers and enables the broader capital toggle without changing the gift-first hero copy.

## Forced fallback verdict
- Command: `node /tmp/globe-smoke.mjs` with `?earthTexture=fail`
- Result: PASS
- Evidence: Chrome CDP smoke reported `FALLBACK {"ok":true,"state":"fallback-earth", ... "forcedTextureMode":"fail"}`.
- Visual/product verdict: forced primary texture failure deterministically transitions to `fallback-earth`, displays a designed fallback status, and keeps the UI free of broken-image/raw-error states.

## Guardrail notes
- Build-only completion avoided: this file records browser-state smoke evidence beyond `npm run build`.
- No plain solid/wireframe ball: wireframe demo layer was removed; the base path uses an Earth texture, and the failure path uses generated ocean/continent/cloud-like canvas texture.
- Markers/cards hidden until Earth is ready: smoke verifies `visible capitals` is `0` in initial ready state, then `12` only after exploration toggle.
