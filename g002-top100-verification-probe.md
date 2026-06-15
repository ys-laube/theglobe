# G002 TOP100 verification probe

Task: `G002-top100-ranked-exploration-add-exactl` worker-2 verification probe.

## Current evidence

- Data verifier already enforces exactly 100 TOP100 rows and contiguous ranks 1-100 in `scripts/verify-city-data.mjs`.
- Existing browser smoke opens exploration mode, toggles to TOP100, and asserts:
  - `[data-visible-count]` becomes `100`
  - `[data-tier-title]` becomes `TOP 100 인기 도시`
  - `[data-action="toggle-tier"]` label changes to `수도 보기`
  - `.city-card` remains present
  - globe auto-rotation delta is non-zero
- Current UI implementation (`src/explorationOverlay.ts`) renders region chips into `[data-region-list]`; it does not yet render a grouped TOP100 city list or city-list item controls in the DOM.
- Current QA state (`window.__GLOBE_QA__` in `src/main.ts`) exposes `globeRotation`, `explorationMode`, and view/Korea state, but not the selected city/card identity.

## Test change made by this probe

`verify-city-data.mjs` now explicitly derives ten rank buckets (`1-10` through `91-100`) and asserts every bucket contains exactly 10 TOP100 entries. This locks the data-side contract needed by the future grouped UI without mutating product code or `.omx/ultragoal`.

## Recommended post-change smoke selectors/assertions

When the grouped TOP100 list UI lands, add stable selectors rather than relying on Korean copy:

- List container: `[data-top100-list]`
- Group: `[data-top100-group]` with `data-rank-start` and `data-rank-end`
- Group heading/label: `[data-top100-group-label]`
- City item button: `[data-top100-city]` with `data-rank` and `data-city-id`
- Card selected state: expose `selectedCityId`, `selectedCityRank`, and `selectedCityMode` on `window.__GLOBE_QA__`

Concrete smoke assertions:

```js
const groups = [...document.querySelectorAll('[data-top100-group]')];
if (groups.length !== 10) throw new Error(`Expected 10 TOP100 groups, found ${groups.length}`);

groups.forEach((group, index) => {
  const start = index * 10 + 1;
  const end = start + 9;
  if (group.dataset.rankStart !== String(start) || group.dataset.rankEnd !== String(end)) {
    throw new Error(`Expected TOP100 group ${start}-${end}, found ${group.dataset.rankStart}-${group.dataset.rankEnd}`);
  }
  const items = [...group.querySelectorAll('[data-top100-city]')];
  if (items.length !== 10) throw new Error(`Expected 10 cities in group ${start}-${end}, found ${items.length}`);
});

const ranks = [...document.querySelectorAll('[data-top100-city]')].map((item) => Number(item.dataset.rank));
if (ranks.length !== 100 || !ranks.every((rank, index) => rank === index + 1)) {
  throw new Error(`Expected contiguous visible TOP100 ranks 1-100, found ${ranks.join(',')}`);
}

const firstCity = document.querySelector('[data-top100-city][data-rank="1"]');
const beforeRotation = window.__GLOBE_QA__?.globeRotation;
firstCity.click();
await waitFor(() => window.__GLOBE_QA__?.selectedCityRank === 1, 'rank 1 card selection');
await waitFor(() => document.querySelector('.city-card')?.dataset.empty === 'false', 'city card opened');
const afterRotation = window.__GLOBE_QA__?.globeRotation;
const rotationChanged = Math.abs(afterRotation.y - beforeRotation.y) > 0.01 || Math.abs(afterRotation.x - beforeRotation.x) > 0.01;
if (!rotationChanged) throw new Error('Expected city list click to focus/rotate globe');
```

These assertions cover exactly 10 groups of 10, contiguous rank labels 1-100, and list-item click opening the existing detail card while changing/focusing the globe.
