import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = [
  'src/main.ts',
  'src/globeRenderer.ts',
  'src/assetsPolicy.ts',
  'src/explorationOverlay.ts',
  'src/koreaFamilyOverlay.ts',
];
const sources = Object.fromEntries(await Promise.all(
  sourceFiles.map(async (file) => [file, await readFile(join(root, file), 'utf8')])
));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const combined = Object.values(sources).join('\n');
const forbiddenVisibleCopy = [
  'The globe is glowing with its final details.',
  'Earth imagery and optional atmosphere enhancements are active.',
  'Earth surface texture from the Three.js examples planets set; planning source references NASA Blue Marble / Earth Observatory imagery.',
  'Cloud texture from the Three.js examples planets set; optional non-blocking enhancement.',
  'Night-lights texture from the Three.js examples planets set; optional non-blocking enhancement.',
  'Earth imagery policy loading…',
];

for (const copy of forbiddenVisibleCopy) {
  assert(!combined.includes(copy), `technical visible UI copy must be absent: ${copy}`);
}


const requiredGiftCopy = [
  'where are you? where do you want to go?',
  '전 세계 UN가입국의 수도를 보여줍니다',
  '17 광역자치단체',
  '관할 기초자치단체',
  '암구호를 대시오!',
  '암구호 확인',
  '암구호 틀림',
];
for (const copy of requiredGiftCopy) {
  assert(combined.includes(copy), `required polished UI copy must be present: ${copy}`);
}

const forbiddenKoreaCopy = [
  'Official static region',
  'official static region',
  '17 first-level regions',
  '17-first-level region',
  '우리 가족이 이어지는 지도',
  '빛나는 길을 따라',
  '가족 이름',
  '예: 한유진',
  '로그인이나 개인정보 저장 없이',
  '초대 링크 열기',
  '이름을 다시 확인해 주세요',
  'The globe is glowing with its final details.',
];
for (const copy of forbiddenKoreaCopy) {
  assert(!combined.includes(copy), `old visible UI copy must be absent: ${copy}`);
}

assert(!sources['src/main.ts'].includes("state.replaceAll('-', ' ');"), 'UI must not render raw technical state ids such as asset enhancement ready');
assert(sources['src/main.ts'].includes('friendlyStateLabels'), 'main UI must map runtime state ids to family-friendly labels');
assert(sources['src/globeRenderer.ts'].includes('where are you? where do you want to go?'), 'final ready message should use the approved first-screen copy');

console.log('PASS UI copy smoke: approved G001 copy/gate polish is present and old copy is absent');
