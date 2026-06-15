import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [top100Raw, overlaySource, rendererSource, mainSource] = await Promise.all([
  readFile(join(root, 'src/data/top100Cities.json'), 'utf8'),
  readFile(join(root, 'src/explorationOverlay.ts'), 'utf8'),
  readFile(join(root, 'src/globeRenderer.ts'), 'utf8'),
  readFile(join(root, 'src/main.ts'), 'utf8'),
]);
const top100 = JSON.parse(top100Raw);
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
assert(top100.cities.length === 100, 'TOP100 data must contain exactly 100 cities');
const buckets = Array.from({ length: 10 }, (_value, index) => {
  const min = index * 10 + 1;
  return top100.cities.filter((city) => city.rank >= min && city.rank <= min + 9);
});
assert(buckets.every((bucket) => bucket.length === 10), 'TOP100 data must split into ten rank buckets of ten cities');
assert(overlaySource.includes('data-rank-group'), 'overlay must render rank group elements for TOP100');
assert(overlaySource.includes('button.dataset.cityId = capital.id'), 'overlay must render clickable city list buttons');
assert(overlaySource.includes('focusCity(capital)'), 'overlay list/marker selection must focus and open the card');
assert(rendererSource.includes('focusLocation'), 'renderer must expose focusLocation for city focus');
assert(rendererSource.includes('focusRotation'), 'renderer must animate toward focusRotation city target');

assert(rendererSource.includes('new THREE.SphereGeometry(0.105, 20, 20)'), 'Korea hotspot hit area must stay narrowed so Seoul/Jeju markers are not swallowed');
assert(rendererSource.includes('intersections.find((intersection) => intersection.object.userData.capital)'), 'renderer picking must prioritize city markers over Korea hotspot');
assert(rendererSource.includes('projectLocation'), 'renderer must expose deterministic projected city coordinates for Seoul/Jeju smoke fixtures');
assert(mainSource.includes('__GLOBE_QA_PROJECT_LOCATION__'), 'QA helper must expose projected marker coordinates for browser smoke fixtures');
assert(mainSource.includes('selectedCityId') && mainSource.includes('lastFocusRotationDelta') && mainSource.includes('selectedCityCardOpen'), 'QA state must expose exploration list/focus/card contract');
console.log('PASS TOP100 exploration smoke: 10 groups, 100 clickable cities, focus/card QA contract present');
