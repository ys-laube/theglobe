import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const worldCapitals = JSON.parse(await readFile(join(root, 'src/data/worldCapitals.json'), 'utf8'));
const top100Cities = JSON.parse(await readFile(join(root, 'src/data/top100Cities.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHttpsUrl(value, context) {
  const parsed = new URL(value);
  assert(parsed.protocol === 'https:', `${context} must use HTTPS`);
}

function assertCoordinates(row, context) {
  assert(Number.isFinite(row.lat) && row.lat >= -90 && row.lat <= 90, `${context} latitude must be valid`);
  assert(Number.isFinite(row.lng) && row.lng >= -180 && row.lng <= 180, `${context} longitude must be valid`);
}

function assertUniqueRows(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    assert(typeof row.id === 'string' && row.id.length > 0, `${label} row id is required`);
    assert(!seen.has(row.id), `${label} row id must be unique: ${row.id}`);
    seen.add(row.id);
  }
}

assert(worldCapitals.schemaVersion === 1, 'world capitals schemaVersion must be 1');
assert(worldCapitals.datasetId === 'world-capitals-wikidata-snapshot-2026-06-15', 'world capitals dataset id must be stable');
assert(worldCapitals.source.id === dataProvenance.capitals.approvedSources[0].id, 'world capitals source must match provenance-approved source');
assert(worldCapitals.source.queryUrl === dataProvenance.capitals.approvedSources[0].url, 'world capitals query URL must match provenance');
assert(typeof worldCapitals.source.extractedAt === 'string' && worldCapitals.source.extractedAt.length > 0, 'world capitals extraction date is required');
assert(worldCapitals.source.licenseUsageNote.includes('Static'), 'world capitals license/static usage note is required');
assert(worldCapitals.inclusionRule === dataProvenance.capitals.inclusionRule, 'world capitals inclusion rule must match provenance');
assert(worldCapitals.legacyBaselineCount === dataProvenance.capitals.currentLegacyCount, 'world capitals legacy baseline must match provenance');
assert(worldCapitals.minimumRequiredCount === dataProvenance.capitals.minimumBundledCount, 'world capitals minimum count must match provenance');
assert(Array.isArray(worldCapitals.capitals), 'world capitals rows must be an array');
assert(worldCapitals.capitals.length >= worldCapitals.minimumRequiredCount, 'world capitals must meet minimum required count');
assert(worldCapitals.capitals.length > worldCapitals.legacyBaselineCount, 'world capitals must expand beyond legacy 33 entries');
assertUniqueRows(worldCapitals.capitals, 'world capital');

for (const capital of worldCapitals.capitals) {
  assert(typeof capital.city === 'string' && capital.city.length > 0, `${capital.id} city is required`);
  assert(typeof capital.country === 'string' && capital.country.length > 0, `${capital.id} country is required`);
  assert(typeof capital.capitalOf === 'string' && capital.capitalOf.length > 0, `${capital.id} capitalOf is required`);
  assert(typeof capital.region === 'string' && capital.region.length > 0, `${capital.id} region is required`);
  assert(capital.sourceId === worldCapitals.source.id, `${capital.id} sourceId must match dataset source`);
  assertCoordinates(capital, `world capital ${capital.id}`);
  assertHttpsUrl(capital.link, `world capital ${capital.id} link`);
}

assert(top100Cities.schemaVersion === 1, 'TOP100 schemaVersion must be 1');
assert(top100Cities.datasetId === 'top100-city-destinations-euromonitor-2018-static-v1', 'TOP100 dataset id must be stable');
assert(top100Cities.source.id === dataProvenance.top100Cities.sourceLock, 'TOP100 source id must match provenance source lock');
assert(top100Cities.source.url === dataProvenance.top100Cities.approvedSources[0].url, 'TOP100 source URL must match provenance');
assert(top100Cities.source.rankingDate === dataProvenance.top100Cities.rankingDate, 'TOP100 ranking date must match provenance');
assert(top100Cities.requiredCount === dataProvenance.top100Cities.requiredCount, 'TOP100 required count must match provenance');
assert(top100Cities.requiredRanks === dataProvenance.top100Cities.requiredRanks, 'TOP100 required ranks must match provenance');
assert(top100Cities.source.licenseUsageNote.includes('Static'), 'TOP100 static usage note is required');
assert(Array.isArray(top100Cities.cities), 'TOP100 rows must be an array');
assert(top100Cities.cities.length === top100Cities.requiredCount, 'TOP100 must include exactly 100 rows');
assertUniqueRows(top100Cities.cities, 'TOP100 city');

const ranks = new Set();
for (const [index, city] of top100Cities.cities.entries()) {
  assert(Number.isInteger(city.rank), `${city.id} rank must be an integer`);
  assert(city.rank === index + 1, `${city.id} rank order must be contiguous and sorted`);
  assert(city.rank >= 1 && city.rank <= 100, `${city.id} rank must be 1-100`);
  assert(!ranks.has(city.rank), `${city.id} rank must be unique: ${city.rank}`);
  ranks.add(city.rank);
  assert(typeof city.city === 'string' && city.city.length > 0, `${city.id} city is required`);
  assert(typeof city.country === 'string' && city.country.length > 0, `${city.id} country is required`);
  assert(city.sourceId === top100Cities.source.id, `${city.id} sourceId must match dataset source`);
  assertCoordinates(city, `TOP100 city ${city.id}`);
  assertHttpsUrl(city.link, `TOP100 city ${city.id} link`);
}
for (let rank = 1; rank <= 100; rank += 1) {
  assert(ranks.has(rank), `TOP100 rank missing: ${rank}`);
}

assert(dataProvenance.validationContract.cityDataVerifier.includes('scripts/verify-city-data.mjs'), 'provenance must point at verify-city-data script');

console.log(`PASS city data validation (${worldCapitals.capitals.length} capitals, ${top100Cities.cities.length} TOP100 cities)`);
