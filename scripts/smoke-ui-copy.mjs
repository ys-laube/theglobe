import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = [
  'src/main.ts',
  'src/globeRenderer.ts',
  'src/assetsPolicy.ts',
];
const sources = Object.fromEntries(await Promise.all(
  sourceFiles.map(async (file) => [file, await readFile(join(root, file), 'utf8')])
));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const combined = Object.values(sources).join('\n');
const forbiddenVisibleCopy = [
  'Earth imagery and optional atmosphere enhancements are active.',
  'Earth surface texture from the Three.js examples planets set; planning source references NASA Blue Marble / Earth Observatory imagery.',
  'Cloud texture from the Three.js examples planets set; optional non-blocking enhancement.',
  'Night-lights texture from the Three.js examples planets set; optional non-blocking enhancement.',
  'Earth imagery policy loading…',
];

for (const copy of forbiddenVisibleCopy) {
  assert(!combined.includes(copy), `technical visible UI copy must be absent: ${copy}`);
}

assert(!sources['src/main.ts'].includes("state.replaceAll('-', ' ');"), 'UI must not render raw technical state ids such as asset enhancement ready');
assert(sources['src/main.ts'].includes('friendlyStateLabels'), 'main UI must map runtime state ids to family-friendly labels');
assert(sources['src/globeRenderer.ts'].includes('The globe is glowing with its final details.'), 'final ready message should remain non-technical');

console.log('PASS UI copy smoke: technical Earth status/attribution residue absent from visible copy surfaces');
