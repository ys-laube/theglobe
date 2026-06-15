import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const boundaries = JSON.parse(await readFile(join(root, 'src/mapData/koreaFamilyBoundaries.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'src/mapData/boundaryProvenance.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const worldBorders = JSON.parse(await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8'));
const householdConfigSource = await readFile(join(root, 'src/householdConfig.ts'), 'utf8');
const koreaOverlaySource = await readFile(join(root, 'src/koreaFamilyOverlay.ts'), 'utf8');
const mainSource = await readFile(join(root, 'src/main.ts'), 'utf8');
const globeRendererSource = await readFile(join(root, 'src/globeRenderer.ts'), 'utf8');
const packageLockSource = await readFile(join(root, 'package-lock.json'), 'utf8');
const mapDataReadme = await readFile(join(root, 'src/mapData/README.md'), 'utf8');
const rootReadme = await readFile(join(root, 'README.md'), 'utf8');
const worldBordersRaw = await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8');
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
assert(Array.isArray(boundaries.usageConstraints), 'boundary data must publish usage constraints');
for (const requiredConstraint of [
  'Decorative family-path overlay only',
  'No legal-boundary accuracy claims',
  'No live map tiles, live map APIs, backend services, auth, or runtime API keys',
]) {
  assert(boundaries.usageConstraints.includes(requiredConstraint), `missing boundary usage constraint: ${requiredConstraint}`);
}

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

const expectedTiers = new Map([
  ['kr-country-stylized', 'country'],
  ['kr-seoul-stylized', 'province-city'],
  ['kr-seoul-mapo-stylized', 'district'],
  ['kr-busan-stylized', 'province-city'],
  ['kr-busan-haeundae-stylized', 'district'],
  ['kr-gyeongnam-stylized', 'province'],
  ['kr-gyeongnam-gimhae-stylized', 'city'],
  ['kr-gimhae-bonghwang-stylized', 'neighborhood'],
]);
const expectedFamilyPathRoles = new Map([
  ['kr-country-stylized', 'entry'],
  ['kr-seoul-stylized', 'brother-branch'],
  ['kr-seoul-mapo-stylized', 'brother-household-district'],
  ['kr-busan-stylized', 'sister-parents-branch'],
  ['kr-busan-haeundae-stylized', 'sister-parents-household-district'],
  ['kr-gyeongnam-stylized', 'home-branch'],
  ['kr-gyeongnam-gimhae-stylized', 'home-city'],
  ['kr-gimhae-bonghwang-stylized', 'home-neighborhood'],
]);
for (const feature of boundaries.features) {
  assert(feature.tier === expectedTiers.get(feature.id), `${feature.id} must keep its approved boundary tier`);
  assert(feature.familyPathRole === expectedFamilyPathRoles.get(feature.id), `${feature.id} must keep its family path role`);
}

const expectedTerminalRegions = ['kr-busan-haeundae-stylized', 'kr-gimhae-bonghwang-stylized', 'kr-seoul-mapo-stylized'];
const pathEnds = boundaries.familyPathOrder.map((path) => path.at(-1)).sort();
assert(JSON.stringify(pathEnds) === JSON.stringify(expectedTerminalRegions.sort()), 'family paths must end at Haeundae, Mapo, and Bonghwang');

assert(provenance.committedAssetStrategy.status === 'permissive-for-repository', 'committed strategy must be permissive-for-repository');
assert(provenance.committedAssetStrategy.summary.includes('hand-authored'), 'provenance must document hand-authored committed geometry');
assert(provenance.committedAssetStrategy.accuracyNotice.includes('Decorative navigation art only'), 'provenance must keep decorative-only accuracy notice');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'natural-earth-admin0-boundary-lines'), 'Natural Earth source candidate is required');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'committed-natural-earth-110m-country-border-lines'), 'Committed Natural Earth world border provenance is required');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'data-go-kr-molit-daily-legal-district-shp'), 'Korean official legal-boundary source candidate is required');
assert(provenance.excludedSources.some((source) => source.id === 'gadm'), 'GADM exclusion is required');
assert(provenance.excludedSources.some((source) => source.id === 'live-map-tiles-or-client-api'), 'live map/API exclusion is required');
for (const source of provenance.verifiedSourceCandidates) {
  assert(source.url?.startsWith('https://'), `source ${source.id} must keep an https provenance URL`);
  assert(source.licenseSummary && source.permittedUseDecision && source.implementationNote, `source ${source.id} must keep license, decision, and implementation notes`);
}

assert(dataProvenance.schemaVersion === 1, 'data provenance schemaVersion must be 1');
assert(dataProvenance.id === 'globe-static-data-provenance-v1', 'data provenance id must be stable');
assert(dataProvenance.staticFirstPolicy.runtimeDataFetchesRequired === false, 'core data must not require runtime fetches');
assert(dataProvenance.staticFirstPolicy.backendRequired === false, 'core data must not require a backend');
assert(dataProvenance.staticFirstPolicy.apiKeyRequired === false, 'core data must not require API keys');

const runtimeSources = [
  ['src/main.ts', mainSource],
  ['src/koreaFamilyOverlay.ts', koreaOverlaySource],
  ['src/globeRenderer.ts', globeRendererSource],
];
for (const [sourcePath, source] of runtimeSources) {
  assert(!/fetch\s*\(/.test(source), `${sourcePath} must not fetch Korea/map/weather data at runtime`);
  assert(!/open-?meteo|weather|forecast/i.test(source), `${sourcePath} must not reintroduce weather/forecast runtime UI`);
  assert(!/kakao|naver\s*map|google\s*maps|mapbox|leaflet|vworld/i.test(source), `${sourcePath} must not depend on a runtime map API`);
}
assert(!/\"(leaflet|mapbox-gl|@googlemaps\/[^\"]+|ol|kakao)\"/.test(packageLockSource), 'package lock must not include runtime map API dependencies');

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

assert(dataProvenance.top100Cities.sourceLock === 'euromonitor-top100-city-destinations-2018', 'TOP100 source lock must be Euromonitor Top 100 City Destinations 2018');
assert(dataProvenance.top100Cities.requiredCount === 100, 'TOP100 contract must require exactly 100 cities');
assert(dataProvenance.top100Cities.requiredRanks === '1-100-contiguous', 'TOP100 contract must require ranks 1-100');
assert(dataProvenance.top100Cities.rankingDate === '2018-11-01', 'TOP100 ranking date must be locked');
assert(dataProvenance.top100Cities.approvedSources.some((source) => source.id === 'euromonitor-top100-city-destinations-2018'), 'TOP100 source lock must include Euromonitor Top 100 City Destinations 2018');
assert(dataProvenance.top100Cities.rejectedSources.some((source) => source.id === 'agoda-partial-public-posts'), 'TOP100 lock must reject partial Agoda public posts');
assert(dataProvenance.top100Cities.rejectedSources.some((source) => source.id === 'mastercard-gdci-2019-top20-only'), 'TOP100 lock must reject Mastercard top-20-only data for exact 100');

assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-boundary-data.mjs'), 'npm verify:data must run the boundary/provenance verifier');
assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-city-data.mjs'), 'npm verify:data must run the city-data verifier');
assert(packageManifest.scripts?.verify?.includes('npm run verify:data'), 'npm verify must include boundary/provenance verification');
assert(rootReadme.includes('npm run verify'), 'root README must document the aggregate npm verification command');
assert(rootReadme.includes('src/mapData/boundaryProvenance.json'), 'root README must link the provenance document');
assert(mapDataReadme.includes('worldCountryBorders.json'), 'map data README must document the bundled world border asset');
assert(mapDataReadme.includes('npm run verify:data'), 'map data README must document the data/provenance verification command');
assert(mapDataReadme.includes('No live map API calls'), 'map data README must preserve no-live-map runtime constraint');

assert(dataProvenance.schemaVersion === 1, 'data provenance schemaVersion must be 1');
assert(dataProvenance.id === 'globe-static-data-provenance-v1', 'data provenance id must be stable');
assert(dataProvenance.staticFirstPolicy.runtimeDataFetchesRequired === false, 'core data must not require runtime fetches');
assert(dataProvenance.staticFirstPolicy.backendRequired === false, 'core data must not require a backend');
assert(dataProvenance.staticFirstPolicy.apiKeyRequired === false, 'core data must not require API keys');

const runtimeSources = [
  ['src/main.ts', mainSource],
  ['src/koreaFamilyOverlay.ts', koreaOverlaySource],
  ['src/globeRenderer.ts', globeRendererSource],
];
for (const [sourcePath, source] of runtimeSources) {
  assert(!/fetch\s*\(/.test(source), `${sourcePath} must not fetch Korea/map/weather data at runtime`);
  assert(!/open-?meteo|weather|forecast/i.test(source), `${sourcePath} must not reintroduce weather/forecast runtime UI`);
  assert(!/kakao|naver\s*map|google\s*maps|mapbox|leaflet|vworld/i.test(source), `${sourcePath} must not depend on a runtime map API`);
}
assert(!/\"(leaflet|mapbox-gl|@googlemaps\/[^\"]+|ol|kakao)\"/.test(packageLockSource), 'package lock must not include runtime map API dependencies');

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

assert(dataProvenance.top100Cities.sourceLock === 'euromonitor-top100-city-destinations-2018', 'TOP100 source lock must be Euromonitor Top 100 City Destinations 2018');
assert(dataProvenance.top100Cities.requiredCount === 100, 'TOP100 contract must require exactly 100 cities');
assert(dataProvenance.top100Cities.requiredRanks === '1-100-contiguous', 'TOP100 contract must require ranks 1-100');
assert(dataProvenance.top100Cities.rankingDate === '2018-11-01', 'TOP100 ranking date must be locked');
assert(dataProvenance.top100Cities.approvedSources.some((source) => source.id === 'euromonitor-top100-city-destinations-2018'), 'TOP100 source lock must include Euromonitor Top 100 City Destinations 2018');
assert(dataProvenance.top100Cities.rejectedSources.some((source) => source.id === 'agoda-partial-public-posts'), 'TOP100 lock must reject partial Agoda public posts');
assert(dataProvenance.top100Cities.rejectedSources.some((source) => source.id === 'mastercard-gdci-2019-top20-only'), 'TOP100 lock must reject Mastercard top-20-only data for exact 100');

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
  parents: { label: '한가네 본가', location: '부산광역시 해운대구', names: ['한봉수', '이은주'], slots: 2, terminalRegion: 'kr-busan-haeundae-stylized' },
  sister: { label: '건희민하찬희네', location: '부산광역시 해운대구', names: ['한유진', '박재춘', '박건희', '박민하', '박찬희'], slots: 3, terminalRegion: 'kr-busan-haeundae-stylized' },
  brother: { label: '진주네', location: '서울특별시 마포구', names: ['한동석', '김혜리', '한진주'], slots: 1, terminalRegion: 'kr-seoul-mapo-stylized' },
  home: { label: '은하네', location: '경상남도 김해시 봉황동', names: ['한영석', '서혜빈', '한은하'], slots: 1, terminalRegion: 'kr-gimhae-bonghwang-stylized' },
};

for (const [householdId, expectation] of Object.entries(expectedHouseholds)) {
  assert(householdConfigSource.includes(`id: '${householdId}'`), `missing household config for ${householdId}`);
  assert(householdConfigSource.includes(`label: '${expectation.label}'`), `missing household label ${expectation.label} for ${householdId}`);
  assert(householdConfigSource.includes(`locationLabel: '${expectation.location}'`), `missing household location ${expectation.location} for ${householdId}`);
  for (const name of expectation.names) {
    assert(householdConfigSource.includes(`'${name}'`), `missing accepted name ${name} for ${householdId}`);
  }
  const slotMatches = householdConfigSource.match(new RegExp(`householdId: '${householdId}'`, 'g')) ?? [];
  assert(slotMatches.length === expectation.slots, `${householdId} must have ${expectation.slots} Naver Band slot(s)`);
  assert(koreaOverlaySource.includes(`'${householdId}'`), `Korea overlay must route to household ${householdId}`);
  assert(koreaOverlaySource.includes(expectation.terminalRegion), `Korea overlay must retain terminal region ${expectation.terminalRegion} for ${householdId}`);
}
assert(koreaOverlaySource.includes('household-marker'), 'Korea overlay must render glowing household markers on the map');
assert(koreaOverlaySource.includes('householdMarkers'), 'Korea overlay must keep an explicit household marker model');


const declaredSlotIds = householdConfigSource.match(/\{ id: '[^']+-band-\d+'/g) ?? [];
assert(declaredSlotIds.length === 7, 'household config must declare exactly 7 Band slot ids');
assert(new Set(declaredSlotIds).size === declaredSlotIds.length, 'declared household Band slot ids must be unique');
const placeholderMatches = householdConfigSource.match(/placeholderHref: 'https:\/\/band\.us\/band\/[^']+'/g) ?? [];
const statusMatches = householdConfigSource.match(/, status: 'placeholder' }/g) ?? [];
assert(placeholderMatches.length === 7, 'household config must expose exactly 7 band.us placeholder links');
assert(statusMatches.length === 7, 'all household link slots must remain placeholder status until real URLs are supplied');
assert(householdConfigSource.includes('validateHouseholdConfig(householdConfig)'), 'household config validation must remain exported');
assert(householdConfigSource.includes('householdConfigValidation = validateHouseholdConfig(householdConfig)'), 'household config validation result must remain exported');

for (const docsSource of [mapDataReadme, rootReadme]) {
  assert(docsSource.includes('No backend') || docsSource.includes('no backend'), 'docs must preserve no-backend constraint');
  assert(docsSource.includes('live map API') || docsSource.includes('live map APIs'), 'docs must preserve no-live-map-API constraint');
}

console.log('PASS boundary/provenance/household validation');
