import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const boundaries = JSON.parse(await readFile(join(root, 'src/mapData/koreaFamilyBoundaries.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'src/mapData/boundaryProvenance.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const worldBorders = JSON.parse(await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8'));
const householdConfigSource = await readFile(join(root, 'src/householdConfig.ts'), 'utf8');
const worldBordersRaw = await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8');
const rootReadme = await readFile(join(root, 'README.md'), 'utf8');
const mapDataReadme = await readFile(join(root, 'src/mapData/README.md'), 'utf8');
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(boundaries.schemaVersion === 1, 'boundary schemaVersion must be 1');
assert(boundaries.coordinateSystem === 'normalized-svg-0-100', 'boundary coordinate system must stay normalized and static');
assert(boundaries.provenanceId === provenance.id, 'boundary provenanceId must match provenance document');
assert(Array.isArray(boundaries.features), 'features must be an array');
assert(boundaries.features.length === 8, 'expected exactly 8 stylized family-path boundary features');
assert(Array.isArray(boundaries.worldReferenceLines) && boundaries.worldReferenceLines.length === 2, 'expected 2 decorative world reference lines');

const requiredIds = new Set([
  'kr-country-stylized',
  'kr-seoul-stylized',
  'kr-seoul-mapo-stylized',
  'kr-busan-stylized',
  'kr-busan-haeundae-stylized',
  'kr-gyeongnam-stylized',
  'kr-gyeongnam-gimhae-stylized',
  'kr-gimhae-bonghwang-stylized',
]);
const ids = new Set();
for (const feature of boundaries.features) {
  assert(requiredIds.has(feature.id), `unexpected feature id: ${feature.id}`);
  assert(!ids.has(feature.id), `duplicate feature id: ${feature.id}`);
  ids.add(feature.id);
  assert(feature.interactive === true, `${feature.id} must remain an explicit family-path feature`);
  assert(Array.isArray(feature.polygon) && feature.polygon.length >= 4, `${feature.id} needs a bounded polygon`);
  assert(Array.isArray(feature.centroid) && feature.centroid.length === 2, `${feature.id} needs a centroid`);
  for (const [x, y] of [...feature.polygon, feature.centroid]) {
    assert(Number.isFinite(x) && Number.isFinite(y), `${feature.id} coordinates must be finite`);
    assert(x >= 0 && x <= 100 && y >= 0 && y <= 100, `${feature.id} coordinates must stay in normalized bounds`);
  }
}
assert(ids.size === requiredIds.size, 'missing required family-path feature ids');

const pathEnds = boundaries.familyPathOrder.map((path) => path.at(-1)).sort();
assert(JSON.stringify(pathEnds) === JSON.stringify(['kr-busan-haeundae-stylized', 'kr-gimhae-bonghwang-stylized', 'kr-seoul-mapo-stylized'].sort()), 'family paths must end at Haeundae, Mapo, and Bonghwang');

assert(provenance.committedAssetStrategy.status === 'permissive-for-repository', 'committed strategy must be permissive-for-repository');
assert(provenance.committedAssetStrategy.summary.includes('hand-authored'), 'provenance must document hand-authored committed geometry');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'natural-earth-admin0-boundary-lines'), 'Natural Earth source candidate is required');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'committed-natural-earth-110m-country-border-lines'), 'Committed Natural Earth world border provenance is required');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'data-go-kr-molit-daily-legal-district-shp'), 'Korean official legal-boundary source candidate is required');
assert(provenance.excludedSources.some((source) => source.id === 'gadm'), 'GADM exclusion is required');

assert(dataProvenance.schemaVersion === 1, 'data provenance schemaVersion must be 1');
assert(dataProvenance.id === 'globe-static-data-provenance-v1', 'data provenance id must be stable');
assert(dataProvenance.staticFirstPolicy.runtimeDataFetchesRequired === false, 'core data must not require runtime fetches');
assert(dataProvenance.staticFirstPolicy.backendRequired === false, 'core data must not require a backend');
assert(dataProvenance.staticFirstPolicy.apiKeyRequired === false, 'core data must not require API keys');

assert(dataProvenance.koreaBoundaries.committedAssetId === boundaries.assetId, 'Korea boundary data provenance must lock the committed asset id');
assert(dataProvenance.koreaBoundaries.committedProvenanceId === provenance.id, 'Korea boundary data provenance must lock the committed provenance id');
assert(dataProvenance.koreaBoundaries.approvedSources.some((source) => source.id === 'data-go-kr-molit-daily-legal-district-shp'), 'Korea boundary source lock must include MOLIT daily legal district SHP');
assert(dataProvenance.koreaBoundaries.requiredFamilyTargets.includes('부산광역시/해운대구'), 'Korea boundary source lock must preserve Busan/Haeundae family target');
assert(dataProvenance.koreaBoundaries.requiredFamilyTargets.includes('서울특별시/마포구'), 'Korea boundary source lock must preserve Seoul/Mapo family target');
assert(dataProvenance.koreaBoundaries.requiredFamilyTargets.includes('경상남도/김해시/봉황동'), 'Korea boundary source lock must preserve Gyeongnam/Gimhae/Bonghwang family target');
assert(dataProvenance.koreaBoundaries.excludedSources.includes('gadm'), 'Korea boundary source lock must exclude GADM');
assert(dataProvenance.koreaBoundaries.excludedSources.includes('live-map-tiles-or-client-api'), 'Korea boundary source lock must forbid live map tiles/client APIs');

assert(dataProvenance.capitals.sourceLock === 'wikidata-query-service-static-snapshot', 'capital source lock must be Wikidata static snapshot');
assert(dataProvenance.capitals.currentLegacyCount === 33, 'capital source lock must record the legacy 33-entry baseline');
assert(dataProvenance.capitals.minimumBundledCount > dataProvenance.capitals.currentLegacyCount, 'capital contract must require expansion beyond legacy entries');
assert(dataProvenance.capitals.approvedSources.some((source) => source.id === 'wikidata-query-service-capitals'), 'capital source lock must include Wikidata Query Service');

assert(dataProvenance.top100Cities.sourceLock === 'mastercard-global-destination-cities-index-2019-public-report', 'TOP100 source lock must be Mastercard GDCI public report');
assert(dataProvenance.top100Cities.requiredCount === 100, 'TOP100 contract must require exactly 100 cities');
assert(dataProvenance.top100Cities.requiredRanks === '1-100-contiguous', 'TOP100 contract must require ranks 1-100');
assert(dataProvenance.top100Cities.rankingDate === '2019-09-04', 'TOP100 ranking date must be locked');
assert(dataProvenance.top100Cities.approvedSources.some((source) => source.id === 'mastercard-gdci-2019-global-report'), 'TOP100 source lock must include Mastercard GDCI report');
assert(dataProvenance.top100Cities.rejectedSources.some((source) => source.id === 'agoda-partial-public-posts'), 'TOP100 lock must reject partial Agoda public posts');

assert(dataProvenance.weather.baselineMode === 'simulated-static', 'weather baseline must be simulated/static');
assert(dataProvenance.weather.liveEnhancement === 'optional-open-meteo-no-key-only', 'weather live enhancement must be optional Open-Meteo no-key only');
assert(dataProvenance.weather.requiredFallback === 'simulated-or-unavailable-with-disclosure', 'weather fallback disclosure contract is required');
assert(dataProvenance.weather.uiDisclosureRequired === true, 'weather UI disclosure must be required');
assert(dataProvenance.weather.approvedSources.some((source) => source.id === 'open-meteo-forecast-api'), 'weather policy must lock Open-Meteo as optional source');
assert(dataProvenance.weather.forbiddenBehavior.includes('secret key or paid endpoint in client bundle'), 'weather policy must forbid client secrets/paid endpoint');

assert(worldBorders.schemaVersion === 1, 'world border schemaVersion must be 1');
assert(worldBorders.assetId === 'natural-earth-110m-admin0-country-border-lines-v1', 'world border asset id must be stable');
assert(worldBorders.sourceUrl.includes('natural-earth-vector'), 'world border source URL must document Natural Earth vector provenance');
assert(worldBorders.lineCoordinateOrder === 'lat-lng', 'world border line coordinate order must be lat-lng');
assert(Array.isArray(worldBorders.lines) && worldBorders.lines.length >= 150, 'world border asset must include broad country line coverage');
assert(worldBorders.lineCount === worldBorders.lines.length, 'world border lineCount must match lines length');
assert(worldBorders.lines.length <= 320, 'world border line count must stay inside the static app budget');
assert(Buffer.byteLength(worldBordersRaw, 'utf8') <= 220_000, 'world border JSON must stay below the static raw-size budget');
let worldBorderPointCount = 0;
for (const line of worldBorders.lines) {
  assert(Array.isArray(line) && line.length >= 2, 'world border lines must have at least two points');
  worldBorderPointCount += line.length;
  for (const point of line) {
    const [lat, lng] = point;
    assert(Number.isFinite(lat) && lat >= -90 && lat <= 90, 'world border latitude must be finite and valid');
    assert(Number.isFinite(lng) && lng >= -180 && lng <= 180, 'world border longitude must be finite and valid');
  }
}
assert(worldBorderPointCount <= 12_500, 'world border point count must stay inside the static app budget');

const expectedHouseholds = {
  parents: { names: ['한봉수', '이은주'], slots: 2 },
  sister: { names: ['한유진', '박재춘', '박건희', '박민하', '박찬희'], slots: 3 },
  brother: { names: ['한동석', '김혜리', '한진주'], slots: 1 },
  home: { names: ['한영석', '서혜빈', '한은하'], slots: 1 },
};

for (const [householdId, expectation] of Object.entries(expectedHouseholds)) {
  assert(householdConfigSource.includes(`id: '${householdId}'`), `missing household config for ${householdId}`);
  for (const name of expectation.names) {
    assert(householdConfigSource.includes(`'${name}'`), `missing accepted name ${name} for ${householdId}`);
  }
  const slotMatches = householdConfigSource.match(new RegExp(`householdId: '${householdId}'`, 'g')) ?? [];
  assert(slotMatches.length === expectation.slots, `${householdId} must have ${expectation.slots} Naver Band slot(s)`);
}

const placeholderMatches = householdConfigSource.match(/placeholderHref: 'https:\/\/band\.us\/band\/[^']+'/g) ?? [];
const statusMatches = householdConfigSource.match(/, status: 'placeholder' }/g) ?? [];
assert(placeholderMatches.length === 7, 'household config must expose exactly 7 band.us placeholder links');
assert(statusMatches.length === 7, 'all household link slots must remain placeholder status until real URLs are supplied');
assert(householdConfigSource.includes('validateHouseholdConfig(householdConfig)'), 'household config validation must remain exported');

console.log('PASS boundary/provenance/data-contract/household validation');
