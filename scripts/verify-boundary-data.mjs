import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const boundaries = JSON.parse(await readFile(join(root, 'src/mapData/koreaFamilyBoundaries.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'src/mapData/boundaryProvenance.json'), 'utf8'));
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const worldBorders = JSON.parse(await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8'));
const worldBordersRaw = await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8');
const householdConfigSource = await readFile(join(root, 'src/householdConfig.ts'), 'utf8');
const koreaOverlaySource = await readFile(join(root, 'src/koreaFamilyOverlay.ts'), 'utf8');
const mainSource = await readFile(join(root, 'src/main.ts'), 'utf8');
const globeRendererSource = await readFile(join(root, 'src/globeRenderer.ts'), 'utf8');
const packageLockSource = await readFile(join(root, 'package-lock.json'), 'utf8');
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const mapDataReadme = await readFile(join(root, 'src/mapData/README.md'), 'utf8');
const rootReadme = await readFile(join(root, 'README.md'), 'utf8');

async function listFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(child));
    else files.push(child);
  }
  return files;
}


async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(child));
    else files.push(child);
  }
  return files;
}


function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameMembers(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  const a = [...actual].sort();
  const e = [...expected].sort();
  assert(JSON.stringify(a) === JSON.stringify(e), `${label} mismatch`);
}

const expectedRegionNames = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
];
const firstLevelIds = new Set([
  'kr-seoul', 'kr-busan', 'kr-daegu', 'kr-incheon', 'kr-gwangju', 'kr-daejeon', 'kr-ulsan', 'kr-sejong',
  'kr-gyeonggi', 'kr-gangwon', 'kr-chungbuk', 'kr-chungnam', 'kr-jeonbuk', 'kr-jeonnam', 'kr-gyeongbuk', 'kr-gyeongnam', 'kr-jeju',
]);
const familyTargetIds = new Set(['kr-seoul-mapo', 'kr-busan-haeundae', 'kr-gyeongnam-gimhae', 'kr-gimhae-bonghwang']);
const requiredIds = new Set([...firstLevelIds, ...familyTargetIds]);
const expectedTiers = new Map([
  ['kr-seoul', 'special-city'], ['kr-busan', 'metropolitan-city'], ['kr-daegu', 'metropolitan-city'], ['kr-incheon', 'metropolitan-city'],
  ['kr-gwangju', 'metropolitan-city'], ['kr-daejeon', 'metropolitan-city'], ['kr-ulsan', 'metropolitan-city'], ['kr-sejong', 'special-self-governing-city'],
  ['kr-gyeonggi', 'province'], ['kr-gangwon', 'special-self-governing-province'], ['kr-chungbuk', 'province'], ['kr-chungnam', 'province'],
  ['kr-jeonbuk', 'special-self-governing-province'], ['kr-jeonnam', 'province'], ['kr-gyeongbuk', 'province'], ['kr-gyeongnam', 'province'], ['kr-jeju', 'special-self-governing-province'],
  ['kr-seoul-mapo', 'district'], ['kr-busan-haeundae', 'district'], ['kr-gyeongnam-gimhae', 'city'], ['kr-gimhae-bonghwang', 'neighborhood'],
]);

assert(boundaries.schemaVersion === 2, 'G003 boundary schemaVersion must be 2');
assert(boundaries.assetId === 'korea-official-static-family-boundaries-v2', 'G003 must use v2 Korea boundary asset id');
assert(boundaries.coordinateSystem === 'normalized-svg-0-100', 'boundary coordinate system must stay normalized and static');
assert(boundaries.geometryKind === 'static-simplified-boundary-guide-polygons', 'G003 must reject legacy stylized geometryKind');
assert(['official-derived', 'documented-guide'].includes(boundaries.sourceClassification), 'boundary sourceClassification must be official-derived or documented-guide');
assert(boundaries.provenanceId === provenance.id, 'boundary provenanceId must match provenance document');
assert(provenance.committedAssetStrategy.assetId === boundaries.assetId, 'provenance asset id must match boundary asset');
assert(dataProvenance.koreaBoundaries.committedAssetId === boundaries.assetId, 'data provenance must lock boundary asset id');
assert(dataProvenance.koreaBoundaries.committedProvenanceId === provenance.id, 'data provenance must lock boundary provenance id');

assert(boundaries.officialSourceSnapshot?.firstLevelRegionCount === 17, 'official source snapshot must document 17 first-level Korea regions');
assert(boundaries.firstLevelRegionPolicy?.expectedOfficialRegionCount === 17, 'boundary data must document expected 17 first-level regions');
sameMembers(boundaries.firstLevelRegionPolicy.expectedOfficialRegionsKo, expectedRegionNames, 'boundary official first-level region names');
assert(dataProvenance.koreaBoundaries.officialFirstLevelRegionContract?.expectedCount === 17, 'data provenance must lock expected 17 first-level regions');
sameMembers(dataProvenance.koreaBoundaries.officialFirstLevelRegionContract.expectedRegionsKo, expectedRegionNames, 'data provenance first-level region names');

assert(Array.isArray(boundaries.features), 'features must be an array');
assert(boundaries.features.length === 21, 'expected 17 first-level regions plus 4 family drilldown targets');
const ids = new Set();
for (const feature of boundaries.features) {
  assert(requiredIds.has(feature.id), `unexpected feature id: ${feature.id}`);
  assert(!ids.has(feature.id), `duplicate feature id: ${feature.id}`);
  ids.add(feature.id);
  assert(feature.interactive === true, `${feature.id} must be interactive`);
  assert(feature.tier === expectedTiers.get(feature.id), `${feature.id} must keep approved tier`);
  assert(Array.isArray(feature.polygon) && feature.polygon.length >= 4, `${feature.id} needs a bounded polygon`);
  assert(Array.isArray(feature.centroid) && feature.centroid.length === 2, `${feature.id} needs a centroid`);
  for (const [x, y] of [...feature.polygon, feature.centroid]) {
    assert(Number.isFinite(x) && x >= 0 && x <= 100, `${feature.id} x coordinate out of normalized range`);
    assert(Number.isFinite(y) && y >= 0 && y <= 100, `${feature.id} y coordinate out of normalized range`);
  }
  if (firstLevelIds.has(feature.id)) {
    assert(feature.adminLevel === 1, `${feature.id} must be adminLevel 1`);
    assert(feature.officialRegionClass === 'first-level-administrative-division', `${feature.id} must be first-level region`);
  }
  if (familyTargetIds.has(feature.id)) {
    assert(feature.adminLevel >= 2, `${feature.id} must be below first level`);
    assert(feature.officialRegionClass === 'family-target-drilldown', `${feature.id} must be family target drilldown`);
  }
}
assert(ids.size === requiredIds.size, 'missing required Korea boundary-guide feature ids');
sameMembers(boundaries.features.filter((feature) => feature.adminLevel === 1).map((feature) => feature.nameKo), expectedRegionNames, 'rendered first-level region names');

const pathEnds = boundaries.familyPathOrder.map((path) => path.at(-1)).sort();
sameMembers(pathEnds, ['kr-busan-haeundae', 'kr-gimhae-bonghwang', 'kr-seoul-mapo'], 'family path terminal regions');
const expectedTargets = new Map([
  ['busan-haeundae', { terminalFeatureId: 'kr-busan-haeundae', pathKo: ['부산광역시', '해운대구'] }],
  ['seoul-mapo', { terminalFeatureId: 'kr-seoul-mapo', pathKo: ['서울특별시', '마포구'] }],
  ['gyeongnam-gimhae-bonghwang', { terminalFeatureId: 'kr-gimhae-bonghwang', pathKo: ['경상남도', '김해시', '봉황동'] }],
]);
assert(Array.isArray(boundaries.familyTargetCoverage), 'boundary data must declare family target coverage');
assert(boundaries.familyTargetCoverage.length === expectedTargets.size, 'boundary data must cover exactly required family targets');
for (const target of boundaries.familyTargetCoverage) {
  const expected = expectedTargets.get(target.targetId);
  assert(expected, `unexpected family target coverage id: ${target.targetId}`);
  assert(target.terminalFeatureId === expected.terminalFeatureId, `${target.targetId} terminal feature mismatch`);
  assert(JSON.stringify(target.pathKo) === JSON.stringify(expected.pathKo), `${target.targetId} path labels mismatch`);
}

for (const requiredConstraint of ['No legal-boundary accuracy claims', 'No live map tiles, live map APIs, backend services, auth, or runtime API keys']) {
  assert(boundaries.usageConstraints.includes(requiredConstraint), `missing boundary usage constraint: ${requiredConstraint}`);
}
assert(provenance.committedAssetStrategy.status === 'official-source-documented-static', 'committed strategy must be official-source-documented-static');
assert(/decorative guide/i.test(provenance.committedAssetStrategy.accuracyNotice), 'provenance must keep decorative-only accuracy notice');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'data-go-kr-molit-daily-legal-district-shp'), 'Korean official legal-boundary source candidate is required');
assert(provenance.verifiedSourceCandidates.some((source) => source.id === 'committed-natural-earth-110m-country-border-lines'), 'Natural Earth world border source is required');
assert(provenance.excludedSources.some((source) => source.id === 'live-map-tiles-or-client-api'), 'live map/API exclusion is required');
for (const source of provenance.verifiedSourceCandidates) {
  assert(source.url?.startsWith('https://'), `source ${source.id} must keep an https provenance URL`);
  assert(source.licenseSummary && source.permittedUseDecision && source.implementationNote, `source ${source.id} must keep license, decision, and implementation notes`);
}

assert(dataProvenance.schemaVersion === 1, 'data provenance schemaVersion must be 1');
assert(dataProvenance.staticFirstPolicy.runtimeDataFetchesRequired === false, 'core data must not require runtime fetches');
assert(dataProvenance.staticFirstPolicy.backendRequired === false, 'core data must not require a backend');
assert(dataProvenance.staticFirstPolicy.apiKeyRequired === false, 'core data must not require API keys');
assert(dataProvenance.koreaBoundaries.approvedSources.some((source) => source.id === 'data-go-kr-molit-daily-legal-district-shp'), 'Korea boundary source lock must include MOLIT daily legal district SHP');
for (const target of ['부산광역시/해운대구', '서울특별시/마포구', '경상남도/김해시/봉황동']) {
  assert(dataProvenance.koreaBoundaries.requiredFamilyTargets.includes(target), `missing family target ${target}`);
}
assert(dataProvenance.koreaBoundaries.excludedSources.includes('live-map-tiles-or-client-api'), 'Korea boundary source lock must forbid live map tiles/client APIs');

for (const [sourcePath, source] of [['src/main.ts', mainSource], ['src/koreaFamilyOverlay.ts', koreaOverlaySource], ['src/globeRenderer.ts', globeRendererSource]]) {
  assert(!/fetch\s*\(/.test(source), `${sourcePath} must not fetch Korea/map/weather data at runtime`);
  assert(!/open-?meteo|weather|forecast/i.test(source), `${sourcePath} must not reintroduce weather/forecast runtime UI`);
  assert(!/kakao|naver\s*map|google\s*maps|mapbox|leaflet|vworld\s*(?:api|sdk|tile|tiles)|vworld\.(?:kr|com)/i.test(source), `${sourcePath} must not depend on runtime map API`);
}
assert(!/"(leaflet|mapbox-gl|@googlemaps\/[^\"]+|ol|kakao)"/.test(packageLockSource), 'package lock must not include runtime map API dependencies');
assert(worldBorders.schemaVersion === 1, 'world border schemaVersion must be 1');
assert(worldBorders.assetId === 'natural-earth-110m-admin0-country-border-lines-v1', 'world border asset id must be stable');
assert(Array.isArray(worldBorders.lines) && worldBorders.lines.length >= 150, 'world border asset must include broad country line coverage');
assert(worldBorders.lines.length <= 320, 'world border line count must stay inside static budget');
assert(Buffer.byteLength(worldBordersRaw, 'utf8') <= 220_000, 'world border JSON must stay below raw-size budget');

const expectedHouseholds = {
  parents: { label: '한가네 본가', location: '부산광역시 해운대구', names: ['한봉수', '이은주'], slots: 2, terminalRegion: 'kr-busan-haeundae' },
  sister: { label: '건희민하찬희네', location: '부산광역시 해운대구', names: ['한유진', '박재춘', '박건희', '박민하', '박찬희'], slots: 3, terminalRegion: 'kr-busan-haeundae' },
  brother: { label: '진주네', location: '서울특별시 마포구', names: ['한동석', '김혜리', '한진주'], slots: 1, terminalRegion: 'kr-seoul-mapo' },
  home: { label: '은하네', location: '경상남도 김해시 봉황동', names: ['한영석', '서혜빈', '한은하'], slots: 1, terminalRegion: 'kr-gimhae-bonghwang' },
};
for (const [householdId, expectation] of Object.entries(expectedHouseholds)) {
  assert(householdConfigSource.includes(`id: '${householdId}'`), `missing household config for ${householdId}`);
  assert(householdConfigSource.includes(`label: '${expectation.label}'`), `missing household label ${expectation.label}`);
  assert(householdConfigSource.includes(`locationLabel: '${expectation.location}'`), `missing household location ${expectation.location}`);
  for (const name of expectation.names) assert(householdConfigSource.includes(`'${name}'`), `missing accepted name ${name}`);
  const slotMatches = householdConfigSource.match(new RegExp(`householdId: '${householdId}'`, 'g')) ?? [];
  assert(slotMatches.length === expectation.slots, `${householdId} must have ${expectation.slots} Naver Band slot(s)`);
  assert(koreaOverlaySource.includes(expectation.terminalRegion), `Korea overlay must retain terminal region ${expectation.terminalRegion}`);
}
assert(koreaOverlaySource.includes('household-marker'), 'Korea overlay must render glowing household markers');
assert(koreaOverlaySource.includes('householdMarkers'), 'Korea overlay must keep explicit household marker model');
const declaredSlotIds = householdConfigSource.match(/\{ id: '[^']+-band-\d+'/g) ?? [];
assert(declaredSlotIds.length === 7, 'household config must declare exactly 7 Band slot ids');
assert(new Set(declaredSlotIds).size === declaredSlotIds.length, 'declared household Band slot ids must be unique');
assert((householdConfigSource.match(/placeholderHref: 'https:\/\/band\.us\/band\/[^']+'/g) ?? []).length === 7, 'household config must expose exactly 7 band.us placeholder links');
assert((householdConfigSource.match(/, status: 'placeholder' }/g) ?? []).length === 7, 'all household link slots must remain placeholder status');
assert(householdConfigSource.includes('validateHouseholdConfig(householdConfig)'), 'household config validation must remain exported');

assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-boundary-data.mjs'), 'npm verify:data must run boundary verifier');
assert(packageManifest.scripts?.['verify:data']?.includes('node scripts/verify-city-data.mjs'), 'npm verify:data must run city-data verifier');
assert(packageManifest.scripts?.verify?.includes('npm run verify:data'), 'npm verify must include boundary/provenance verification');
assert(rootReadme.includes('npm run verify'), 'root README must document npm verification');
assert(rootReadme.includes('src/mapData/boundaryProvenance.json'), 'root README must link provenance document');
assert(mapDataReadme.includes('worldCountryBorders.json'), 'map data README must document bundled world border asset');
assert(mapDataReadme.includes('npm run verify:data'), 'map data README must document verification command');
assert(mapDataReadme.includes('No live map API calls'), 'map data README must preserve no-live-map runtime constraint');


const runtimeSourceFiles = [
  join(root, 'index.html'),
  join(root, 'package.json'),
  ...(await listFiles(join(root, 'src'))).filter((file) => /\.(ts|tsx|js|jsx|css)$/.test(file)),
];
const forbiddenRuntimePatterns = [
  { pattern: /fetch\s*\(/i, label: 'runtime fetch call' },
  { pattern: /XMLHttpRequest/i, label: 'runtime XMLHttpRequest' },
  { pattern: /open-?meteo|forecast|weather/i, label: 'weather/forecast runtime surface' },
  { pattern: /api[_-]?key|apikey|secret[_-]?key|access[_-]?token/i, label: 'runtime API key or secret token surface' },
  { pattern: /https?:\/\/(?:www\.)?(?:vworld\.kr|data\.go\.kr)|@?mapbox|google\.maps|kakao\.maps|naver\.maps/i, label: 'runtime map API/provider surface' },
  { pattern: /\blogin\b|\bauth\b|oauth|firebase|supabase/i, label: 'runtime auth/login/backend surface' },
];
for (const file of runtimeSourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const { pattern, label } of forbiddenRuntimePatterns) {
    assert(!pattern.test(source), `${label} must not be introduced in runtime source: ${file.replace(root + '/', '')}`);
  }
}
assert(!runtimeSourceFiles.some((file) => file.includes('/.omx/')), 'runtime source scan must not include .omx/ultragoal artifacts');


const runtimeSourceFiles = [
  join(root, 'index.html'),
  join(root, 'package.json'),
  ...(await listFiles(join(root, 'src'))).filter((file) => /\.(ts|tsx|js|jsx|css)$/.test(file)),
];
const forbiddenRuntimePatterns = [
  { pattern: /fetch\s*\(/i, label: 'runtime fetch call' },
  { pattern: /XMLHttpRequest/i, label: 'runtime XMLHttpRequest' },
  { pattern: /open-?meteo|forecast|weather/i, label: 'weather/forecast runtime surface' },
  { pattern: /api[_-]?key|apikey|secret[_-]?key|access[_-]?token/i, label: 'runtime API key or secret token surface' },
  { pattern: /https?:\/\/(?:www\.)?(?:vworld\.kr|data\.go\.kr)|@?mapbox|google\.maps|kakao\.maps|naver\.maps/i, label: 'runtime map API/provider surface' },
  { pattern: /\blogin\b|\bauth\b|oauth|firebase|supabase/i, label: 'runtime auth/login/backend surface' },
];
for (const file of runtimeSourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const { pattern, label } of forbiddenRuntimePatterns) {
    assert(!pattern.test(source), `${label} must not be introduced in runtime source: ${file.replace(root + '/', '')}`);
  }
}
assert(!(await pathExists(join(root, '.omx/ultragoal'))), '.omx/ultragoal must not be created or mutated by worker verification');

console.log('PASS boundary/provenance/household validation');
