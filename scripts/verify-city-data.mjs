import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const capitals = JSON.parse(await readFile(join(root, 'src/data/worldCapitals.json'), 'utf8'));
const top100 = JSON.parse(await readFile(join(root, 'src/data/top100Cities.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const cityContent = JSON.parse(await readFile(join(root, 'src/data/cityContent.json'), 'utf8'));
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

const placeholderPatterns = [
  /\$\{?city\}?/i,
  /\blandmarks?\b/i,
  /\bhighlights?\b/i,
  /popular travel dining/i,
  /local food culture/i,
];
function assertContentValue(value, label) {
  assert(typeof value === 'string' && value.trim().length >= 4, `${label} must be non-empty content`);
  assert(!placeholderPatterns.some((pattern) => pattern.test(value)), `${label} must not use placeholder content: ${value}`);
}
function contentFor(mode, entry) {
  const prefix = mode === 'capitals' ? 'capital' : 'top100';
  return cityContent.overrides[`${prefix}:${entry.id}`];
}
assert(cityContent.schemaVersion === 1, 'city content schemaVersion must be 1');
assert(cityContent.source.id === dataProvenance.cityContent.sourceLock, 'city content source id must match provenance lock');
assert(cityContent.source.licenseUsageNote?.length > 0, 'city content license/usage note is required');
assert(cityContent.fallbackPolicy?.includes('explicit city-level overrides'), 'city content policy must require explicit city-level overrides');
assert(Object.keys(cityContent.fallbacks ?? {}).length === 0, 'city content must not use generic runtime fallbacks');
assert(!/regional fallback/i.test(dataProvenance.cityContent?.fallbackPolicy ?? ''), 'data provenance city content policy must not mention regional fallbacks');
const mapDataReadme = await readFile(join(root, 'src/mapData/README.md'), 'utf8');
assert(!/regional fallback/i.test(mapDataReadme), 'map data README must not mention regional fallbacks');
for (const [key, content] of Object.entries(cityContent.overrides)) {
  assertContentValue(content.landmark, `${key} override landmark`);
  assertContentValue(content.food, `${key} override food`);
  assertHttps(content.sourceUrl, `${key} sourceUrl`);
}

assert(capitals.schemaVersion === 1, 'world capitals schemaVersion must be 1');
assert(capitals.datasetId === 'world-capitals-un-member-states-static-2026-06-16', 'world capitals dataset id must lock UN member-state scope');
assert(capitals.source.id === dataProvenance.capitals.sourceLock, 'world capitals source id must match provenance lock');
assertHttps(capitals.source.queryUrl, 'world capitals source queryUrl');
assertHttps(capitals.source.coordinateSourceUrl, 'world capitals coordinateSourceUrl');
assert(typeof capitals.source.extractedAt === 'string' && capitals.source.extractedAt.length >= 10, 'world capitals extraction date is required');
assert(capitals.minimumRequiredCount > capitals.legacyBaselineCount, 'capital minimum must exceed legacy baseline');
assert(capitals.legacyBaselineCount === dataProvenance.capitals.currentLegacyCount, 'capital legacy baseline must match data provenance');
assert(capitals.expectedCount === dataProvenance.capitals.expectedBundledCount, 'capital expected count must match data provenance');
assert(capitals.expectedCount === 193, 'world capitals expectedCount must be exactly 193 UN member states');
assert(capitals.capitals.length === capitals.expectedCount, 'bundled capitals must match exact UN member-state expected count');
assert(capitals.capitals.length > capitals.legacyBaselineCount, 'bundled capitals must exceed legacy 54 entries');
assert(capitals.capitals.length >= capitals.minimumRequiredCount && capitals.minimumRequiredCount === dataProvenance.capitals.minimumBundledCount, 'bundled capitals must satisfy minimum required count');
assert(/UN-member-states-only/i.test(capitals.inclusionRule) && /193/.test(capitals.inclusionRule), 'capital inclusion rule must lock exact UN 193 member-state scope');
assert(!capitals.capitals.some((entry) => entry.id === 'vatican-city' || /vatican/i.test(entry.country)), 'non-UN Vatican City entry must be excluded');
assertUnique(capitals.capitals, 'id', 'capital');
for (const entry of capitals.capitals) {
  assert(entry.sourceId === capitals.source.id, `capital ${entry.id} sourceId must match dataset source`);
  for (const field of ['id', 'city', 'country', 'capitalOf', 'region']) {
    assert(typeof entry[field] === 'string' && entry[field].length > 0, `capital ${entry.id} missing ${field}`);
  }
  assertCoordinate(entry, `capital ${entry.id}`);
  assertHttps(entry.link, `capital ${entry.id} link`);
  const content = contentFor('capitals', entry);
  assert(content, `capital ${entry.id} must have explicit city content override`);
  assertContentValue(content.landmark, `capital ${entry.id} landmark`);
  assertContentValue(content.food, `capital ${entry.id} food`);
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
  const content = contentFor('top100', entry);
  assert(content, `TOP100 ${entry.id} must have explicit city content override`);
  assertContentValue(content.landmark, `TOP100 ${entry.id} landmark`);
  assertContentValue(content.food, `TOP100 ${entry.id} food`);
  assert(!/heritage district|local signature dish|popular travel dining|local food culture|notable landmark|signature local dish|highlights?/i.test(`${content.landmark} ${content.food}`), `TOP100 ${entry.id} must use specific Landmark/Food content, not generic placeholders`);
}


const top100OverrideIds = new Set(Object.keys(cityContent.overrides).filter((key) => key.startsWith('top100:')).map((key) => key.slice('top100:'.length)));
assert(top100OverrideIds.size === top100.cities.length, 'every TOP100 city must have explicit city-level Landmark/Food content');
for (const entry of top100.cities) {
  assert(top100OverrideIds.has(entry.id), `TOP100 ${entry.id} must have explicit city content override`);
}
const capitalOverrideIds = new Set(Object.keys(cityContent.overrides).filter((key) => key.startsWith('capital:')).map((key) => key.slice('capital:'.length)));
assert(capitalOverrideIds.size === capitals.capitals.length, 'every UN193 capital must have explicit city-level Landmark/Food content');
for (const entry of capitals.capitals) {
  assert(capitalOverrideIds.has(entry.id), `capital ${entry.id} must have explicit city content override`);
}

assert(packageManifest.scripts?.['verify:city-data'] === 'node scripts/verify-city-data.mjs', 'npm verify:city-data must run city data verifier');
assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-city-data.mjs') || packageManifest.scripts?.['verify:data']?.includes('npm run verify:city-data'), 'npm verify:data must include city data verifier');
console.log(`PASS city data validation: ${capitals.capitals.length} capitals, ${top100.cities.length} TOP100 cities`);
