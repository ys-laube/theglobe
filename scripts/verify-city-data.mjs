import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cityData = JSON.parse(await readFile(join(root, 'src/mapData/cityData.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHttps(url, label) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `${label} must use https`);
}

assert(cityData.schemaVersion === 1, 'city data schemaVersion must be 1');
assert(cityData.assetId === 'globe-city-data-v1', 'city data asset id must be stable');
assert(cityData.metadata?.staticOnly === true, 'city data must be marked static-only');
assert(cityData.metadata?.runtimeFetchRequired === false, 'city data must not require runtime fetches');
assert(cityData.metadata?.capitalSource?.id === 'wikidata-query-service-capitals-static-snapshot', 'capital metadata must lock Wikidata static snapshot source');
assert(cityData.metadata?.capitalSource?.extractedAt, 'capital metadata must include extractedAt');
assert(cityData.metadata?.capitalSource?.licenseUsageNote, 'capital metadata must include license usage note');
assertHttps(cityData.metadata.capitalSource.url, 'capital source URL');
assert(cityData.metadata?.top100Source?.id === 'mastercard-gdci-2019-global-report-plus-static-completion', 'TOP100 metadata must lock source id');
assert(cityData.metadata.top100Source.rankingDate === dataProvenance.top100Cities.rankingDate, 'TOP100 ranking date must match provenance contract');
assert(cityData.metadata.top100Source.metric === dataProvenance.top100Cities.metric, 'TOP100 metric must match provenance contract');
assert(cityData.metadata.top100Source.licenseUsageNote, 'TOP100 metadata must include license usage note');
assertHttps(cityData.metadata.top100Source.url, 'TOP100 source URL');

assert(Array.isArray(cityData.capitals), 'capitals must be an array');
assert(cityData.capitals.length > dataProvenance.capitals.currentLegacyCount, 'capital dataset must exceed legacy 33-entry baseline');
assert(cityData.capitals.length >= dataProvenance.capitals.minimumBundledCount, 'capital dataset must meet minimum bundled count');
const capitalIds = new Set();
for (const capital of cityData.capitals) {
  assert(typeof capital.id === 'string' && /^[a-z][a-z0-9-]*$/i.test(capital.id), `invalid capital id: ${capital.id}`);
  assert(!capitalIds.has(capital.id), `duplicate capital id: ${capital.id}`);
  capitalIds.add(capital.id);
  assert(typeof capital.name === 'string' && capital.name.length > 1, `${capital.id} needs a name`);
  assert(typeof capital.country === 'string' && capital.country.length > 1, `${capital.id} needs a country`);
  assert(typeof capital.region === 'string' && capital.region.length > 1, `${capital.id} needs a region`);
  assert(Number.isFinite(capital.lat) && capital.lat >= -90 && capital.lat <= 90, `${capital.id} latitude must be valid`);
  assert(Number.isFinite(capital.lng) && capital.lng >= -180 && capital.lng <= 180, `${capital.id} longitude must be valid`);
  assertHttps(capital.sourceUrl, `${capital.id} sourceUrl`);
}
assert(capitalIds.has('seoul') && capitalIds.has('tokyo') && capitalIds.has('washington'), 'capital dataset must preserve core existing capitals');

assert(Array.isArray(cityData.top100Cities), 'top100Cities must be an array');
assert(cityData.top100Cities.length === dataProvenance.top100Cities.requiredCount, 'TOP100 dataset must contain exactly 100 rows');
const topIds = new Set();
const expectedTop20 = ['Bangkok', 'Paris', 'London', 'Dubai', 'Singapore', 'Kuala Lumpur', 'New York', 'Istanbul', 'Tokyo', 'Antalya', 'Seoul', 'Osaka', 'Makkah', 'Phuket', 'Pattaya', 'Milan', 'Barcelona', 'Palma de Mallorca', 'Bali', 'Hong Kong SAR'];
for (const [index, row] of cityData.top100Cities.entries()) {
  const expectedRank = index + 1;
  assert(row.rank === expectedRank, `TOP100 rank ${expectedRank} must be contiguous`);
  assert(typeof row.id === 'string' && /^[a-z0-9-]+$/.test(row.id), `invalid TOP100 id at rank ${row.rank}`);
  assert(!topIds.has(row.id), `duplicate TOP100 id: ${row.id}`);
  topIds.add(row.id);
  assert(typeof row.city === 'string' && row.city.length > 1, `rank ${row.rank} needs city`);
  assert(typeof row.country === 'string' && row.country.length > 1, `rank ${row.rank} needs country`);
  assert(['mastercard-gdci-2019-top20', 'static-ui-seed-completion'].includes(row.sourceTier), `rank ${row.rank} has invalid sourceTier`);
  if (row.rank <= expectedTop20.length) {
    assert(row.city === expectedTop20[index], `rank ${row.rank} must match Mastercard public top-20 order`);
    assert(row.sourceTier === 'mastercard-gdci-2019-top20', `rank ${row.rank} must be marked Mastercard top20`);
    assert(Number.isFinite(row.internationalOvernightVisitorsMm2018) && row.internationalOvernightVisitorsMm2018 > 0, `rank ${row.rank} needs visitor count`);
  } else {
    assert(row.sourceTier === 'static-ui-seed-completion', `rank ${row.rank} must be marked static seed completion`);
    assert(row.internationalOvernightVisitorsMm2018 === undefined, `rank ${row.rank} must not invent Mastercard visitor counts`);
  }
}
assert(topIds.size === 100, 'TOP100 ids must be unique');

assert(packageManifest.scripts?.['verify:city-data'] === 'node scripts/verify-city-data.mjs', 'npm verify:city-data must run city data verifier');
assert(packageManifest.scripts?.['verify:data']?.includes('npm run verify:city-data'), 'npm verify:data must include city data verifier');

console.log('PASS city data validation');
