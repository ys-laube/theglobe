import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const capitals = JSON.parse(await readFile(join(root, 'src/data/worldCapitals.json'), 'utf8'));
const top100 = JSON.parse(await readFile(join(root, 'src/data/top100Cities.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function assertHttps(url, label) {
  assert(typeof url === 'string' && url.startsWith('https://'), `${label} must be an HTTPS URL`);
}
function assertCoordinate(entry, label) {
  assert(Number.isFinite(entry.lat) && entry.lat >= -90 && entry.lat <= 90, `${label} latitude must be valid`);
  assert(Number.isFinite(entry.lng) && entry.lng >= -180 && entry.lng <= 180, `${label} longitude must be valid`);
}
function assertUnique(entries, key, label) {
  const values = entries.map((entry) => entry[key]);
  assert(new Set(values).size === values.length, `${label} ${key} values must be unique`);
}

assert(capitals.schemaVersion === 1, 'world capitals schemaVersion must be 1');
assert(capitals.datasetId === 'world-capitals-sovereign-states-static-2026-06-15', 'world capitals dataset id must be stable');
assert(capitals.source.id === dataProvenance.capitals.sourceLock, 'world capitals source id must match provenance lock');
assertHttps(capitals.source.queryUrl, 'world capitals source queryUrl');
assertHttps(capitals.source.coordinateSourceUrl, 'world capitals coordinateSourceUrl');
assert(typeof capitals.source.extractedAt === 'string' && capitals.source.extractedAt.length >= 10, 'world capitals extraction date is required');
assert(capitals.minimumRequiredCount > capitals.legacyBaselineCount, 'capital minimum must exceed legacy baseline');
assert(capitals.legacyBaselineCount === dataProvenance.capitals.currentLegacyCount, 'capital legacy baseline must match data provenance');
assert(capitals.expectedCount === dataProvenance.capitals.expectedBundledCount, 'capital expected count must match data provenance');
assert(capitals.capitals.length === capitals.expectedCount, 'bundled capitals must match sovereign-states-only expected count');
assert(capitals.capitals.length > capitals.legacyBaselineCount, 'bundled capitals must exceed legacy 54 entries');
assert(capitals.capitals.length >= capitals.minimumRequiredCount && capitals.minimumRequiredCount === dataProvenance.capitals.minimumBundledCount, 'bundled capitals must satisfy minimum required count');
assert(/sovereign-states-only/i.test(capitals.inclusionRule), 'capital inclusion rule must lock sovereign-states-only scope');
assertUnique(capitals.capitals, 'id', 'capital');
for (const entry of capitals.capitals) {
  assert(entry.sourceId === capitals.source.id, `capital ${entry.id} sourceId must match dataset source`);
  for (const field of ['id', 'city', 'country', 'capitalOf', 'region']) {
    assert(typeof entry[field] === 'string' && entry[field].length > 0, `capital ${entry.id} missing ${field}`);
  }
  assertCoordinate(entry, `capital ${entry.id}`);
  assertHttps(entry.link, `capital ${entry.id} link`);
}

assert(top100.schemaVersion === 1, 'TOP100 schemaVersion must be 1');
assert(top100.datasetId === 'top100-city-destinations-euromonitor-2018-static-v1', 'TOP100 dataset id must be stable');
assert(top100.requiredCount === dataProvenance.top100Cities.requiredCount, 'TOP100 required count must match provenance');
assert(top100.requiredRanks === dataProvenance.top100Cities.requiredRanks, 'TOP100 rank policy must match provenance');
assert(top100.cities.length === 100, 'TOP100 must contain exactly 100 cities');
assert(top100.source.id === dataProvenance.top100Cities.sourceLock, 'TOP100 source id must match data provenance source lock');
assert(top100.source.rankingDate === dataProvenance.top100Cities.rankingDate, 'TOP100 ranking date must match provenance');
assert(top100.source.licenseUsageNote?.length > 0, 'TOP100 license/usage note is required');
assertHttps(top100.source.url, 'TOP100 source URL');
assertUnique(top100.cities, 'id', 'TOP100 city');
const ranks = top100.cities.map((entry) => entry.rank).sort((a, b) => a - b);
assert(ranks.every((rank, index) => rank === index + 1), 'TOP100 ranks must be contiguous 1-100');
const rankGroups = Array.from({ length: 10 }, (_, index) => {
  const start = index * 10 + 1;
  const end = start + 9;
  return { start, end, entries: top100.cities.filter((entry) => entry.rank >= start && entry.rank <= end) };
});
assert(rankGroups.every((group) => group.entries.length === 10), 'TOP100 ranks must form exactly ten groups of ten cities');
for (const entry of top100.cities) {
  assert(entry.sourceId === top100.source.id, `TOP100 ${entry.id} sourceId must match dataset source`);
  for (const field of ['id', 'city', 'country', 'region']) {
    assert(typeof entry[field] === 'string' && entry[field].length > 0, `TOP100 ${entry.id} missing ${field}`);
  }
  assertCoordinate(entry, `TOP100 ${entry.id}`);
  assertHttps(entry.link, `TOP100 ${entry.id} link`);
}

assert(packageManifest.scripts?.['verify:city-data'] === 'node scripts/verify-city-data.mjs', 'npm verify:city-data must run city data verifier');
assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-city-data.mjs') || packageManifest.scripts?.['verify:data']?.includes('npm run verify:city-data'), 'npm verify:data must include city data verifier');
console.log(`PASS city data validation: ${capitals.capitals.length} capitals, ${top100.cities.length} TOP100 cities`);
