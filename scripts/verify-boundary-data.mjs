import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const boundaries = JSON.parse(await readFile(join(root, 'src/mapData/koreaFamilyBoundaries.json'), 'utf8'));
const provenance = JSON.parse(await readFile(join(root, 'src/mapData/boundaryProvenance.json'), 'utf8'));
const worldBorders = JSON.parse(await readFile(join(root, 'src/mapData/worldCountryBorders.json'), 'utf8'));

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

assert(worldBorders.schemaVersion === 1, 'world border schemaVersion must be 1');
assert(worldBorders.assetId === 'natural-earth-110m-admin0-country-border-lines-v1', 'world border asset id must be stable');
assert(worldBorders.sourceUrl.includes('natural-earth-vector'), 'world border source URL must document Natural Earth vector provenance');
assert(worldBorders.lineCoordinateOrder === 'lat-lng', 'world border line coordinate order must be lat-lng');
assert(Array.isArray(worldBorders.lines) && worldBorders.lines.length >= 150, 'world border asset must include broad country line coverage');
assert(worldBorders.lineCount === worldBorders.lines.length, 'world border lineCount must match lines length');
for (const line of worldBorders.lines.slice(0, 20)) {
  assert(Array.isArray(line) && line.length >= 2, 'sampled world border lines must have at least two points');
  for (const point of line.slice(0, 4)) {
    const [lat, lng] = point;
    assert(Number.isFinite(lat) && lat >= -90 && lat <= 90, 'world border latitude must be finite and valid');
    assert(Number.isFinite(lng) && lng >= -180 && lng <= 180, 'world border longitude must be finite and valid');
  }
}

console.log('PASS boundary data/provenance validation');
