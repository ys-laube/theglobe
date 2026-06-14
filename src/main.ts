import * as THREE from 'three';
import { capitals, type Capital } from './capitals';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <section class="hero" aria-label="선물 소개">
      <p class="eyebrow">A small planet for bigger dreams</p>
      <h1>건희, 민하, 찬희에게</h1>
      <p class="message">세상은 넓고, 너희가 닿을 곳은 더 넓다.</p>
      <div class="actions">
        <button class="primary" data-action="start">지구본 열기</button>
        <button class="ghost" data-action="toggle-tier">더 많은 수도 보기</button>
      </div>
    </section>

    <section class="globe-stage" aria-label="인터랙티브 3D 지구본">
      <canvas id="globe" aria-label="마우스나 터치로 회전 가능한 3D 지구본"></canvas>
      <div class="halo"></div>
      <div class="hint">드래그해서 돌리고, 빛나는 수도를 눌러보세요</div>
      <article class="city-card" data-empty="true" aria-live="polite">
        <div class="card-art"><span>🌍</span></div>
        <div class="card-copy">
          <p class="card-kicker">Highlight</p>
          <h2>세계가 기다리고 있어</h2>
          <p>빛나는 점을 선택하면 도시의 랜드마크와 음식, 더 알아볼 링크가 열립니다.</p>
        </div>
      </article>
    </section>

    <aside class="panel" aria-label="탐색 상태">
      <div>
        <p class="panel-label">Discovery mode</p>
        <h2 data-tier-title>Premium highlights</h2>
        <p data-tier-copy>첫 화면은 엄선된 하이라이트로 고급스럽게 시작합니다.</p>
      </div>
      <div class="stats">
        <span><strong data-visible-count>0</strong> capitals</span>
        <span><strong>${new Set(capitals.map((c) => c.region)).size}</strong> regions</span>
      </div>
      <div class="region-list" data-region-list></div>
    </aside>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#globe')!;
const card = document.querySelector<HTMLElement>('.city-card')!;
const startButton = document.querySelector<HTMLButtonElement>('[data-action="start"]')!;
const tierButton = document.querySelector<HTMLButtonElement>('[data-action="toggle-tier"]')!;
const tierTitle = document.querySelector<HTMLElement>('[data-tier-title]')!;
const tierCopy = document.querySelector<HTMLElement>('[data-tier-copy]')!;
const visibleCount = document.querySelector<HTMLElement>('[data-visible-count]')!;
const regionList = document.querySelector<HTMLElement>('[data-region-list]')!;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.2, 6.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const radius = 2;
const globeMaterial = new THREE.MeshStandardMaterial({
  color: '#10233f',
  roughness: 0.62,
  metalness: 0.18,
  emissive: '#08182e',
  emissiveIntensity: 0.42,
});
const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), globeMaterial);
globeGroup.add(globe);

const wire = new THREE.Mesh(
  new THREE.SphereGeometry(radius + 0.008, 48, 48),
  new THREE.MeshBasicMaterial({ color: '#b8d8ff', wireframe: true, transparent: true, opacity: 0.055 })
);
globeGroup.add(wire);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(radius + 0.11, 96, 96),
  new THREE.MeshBasicMaterial({ color: '#74d8ff', transparent: true, opacity: 0.08, side: THREE.BackSide })
);
globeGroup.add(atmosphere);

const lights = [
  new THREE.AmbientLight('#8fb6ff', 1.2),
  new THREE.DirectionalLight('#ffffff', 2.8),
  new THREE.PointLight('#7dd3fc', 22, 9),
];
(lights[1] as THREE.DirectionalLight).position.set(4, 3, 5);
(lights[2] as THREE.PointLight).position.set(-3, -2, 4);
scene.add(...lights);

const starGeometry = new THREE.BufferGeometry();
const starPositions: number[] = [];
for (let i = 0; i < 700; i++) {
  const r = 9 + Math.random() * 16;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#dbeafe', size: 0.018, transparent: true, opacity: 0.75 })));

function latLngToVector(lat: number, lng: number, r = radius + 0.045) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function makeMarker(capital: Capital) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(capital.tier === 'highlight' ? 0.045 : 0.027, 18, 18),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.tier === 'highlight' ? 1 : 0.78 })
  );
  marker.position.copy(latLngToVector(capital.lat, capital.lng));
  marker.userData.capital = capital;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(capital.tier === 'highlight' ? 0.075 : 0.045, capital.tier === 'highlight' ? 0.085 : 0.052, 32),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.tier === 'highlight' ? 0.58 : 0.24, side: THREE.DoubleSide })
  );
  ring.position.copy(marker.position.clone().multiplyScalar(1.002));
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  ring.userData.capital = capital;
  return { marker, ring };
}

const markerGroup = new THREE.Group();
globeGroup.add(markerGroup);
const pickables: THREE.Object3D[] = [];
const markerObjects = capitals.map((capital) => ({ capital, ...makeMarker(capital) }));
markerObjects.forEach(({ marker, ring }) => {
  markerGroup.add(marker, ring);
  pickables.push(marker, ring);
});

let showAll = false;
let selected: Capital | null = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(99, 99);
let isDragging = false;
let lastX = 0;
let lastY = 0;
let velocityX = 0.0018;
let velocityY = 0;

function setTier(all: boolean) {
  showAll = all;
  markerObjects.forEach(({ capital, marker, ring }) => {
    const visible = showAll || capital.tier === 'highlight';
    marker.visible = visible;
    ring.visible = visible;
  });
  const data = markerObjects.filter(({ capital }) => showAll || capital.tier === 'highlight').map(({ capital }) => capital);
  visibleCount.textContent = String(data.length);
  tierTitle.textContent = showAll ? 'World capitals' : 'Premium highlights';
  tierCopy.textContent = showAll
    ? '더 많은 나라와 수도를 탐색하되, 카드 내용은 짧고 안정적으로 유지합니다.'
    : '첫 화면은 엄선된 수도로 선물 같은 첫인상을 지킵니다.';
  tierButton.textContent = showAll ? '하이라이트만 보기' : '더 많은 수도 보기';
  const byRegion = [...new Set(data.map((c) => c.region))];
  regionList.innerHTML = byRegion.map((region) => `<span>${region}</span>`).join('');
  if (selected && !data.includes(selected)) showCard(null);
}

function showCard(capital: Capital | null) {
  selected = capital;
  if (!capital) {
    card.dataset.empty = 'true';
    card.innerHTML = `<div class="card-art"><span>🌍</span></div><div class="card-copy"><p class="card-kicker">Highlight</p><h2>세계가 기다리고 있어</h2><p>빛나는 점을 선택하면 도시의 랜드마크와 음식, 더 알아볼 링크가 열립니다.</p></div>`;
    return;
  }
  card.dataset.empty = 'false';
  card.style.setProperty('--accent', capital.accent);
  card.innerHTML = `
    <div class="card-art" style="--accent:${capital.accent}"><span>${capital.city.slice(0, 1)}</span></div>
    <div class="card-copy">
      <p class="card-kicker">${capital.region} · ${capital.country}</p>
      <h2>${capital.city}</h2>
      <p>${capital.note}</p>
      <dl>
        <div><dt>Landmark</dt><dd>${capital.landmark}</dd></div>
        <div><dt>Food</dt><dd>${capital.food}</dd></div>
      </dl>
      <a href="${capital.link}" target="_blank" rel="noreferrer">더 알아보기 ↗</a>
    </div>`;
}

function updatePointer(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pick(event: PointerEvent, commit = false) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables.filter((o) => o.visible), false)[0];
  document.body.style.cursor = hit ? 'pointer' : '';
  if (hit && commit) showCard(hit.object.userData.capital as Capital);
}

canvas.addEventListener('pointerdown', (event) => {
  isDragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (isDragging) {
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    globeGroup.rotation.y += dx * 0.006;
    globeGroup.rotation.x += dy * 0.0035;
    globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x, -0.75, 0.75);
    velocityX = dx * 0.00018;
    velocityY = dy * 0.00008;
    lastX = event.clientX;
    lastY = event.clientY;
  } else {
    pick(event, false);
  }
});
canvas.addEventListener('pointerup', (event) => {
  isDragging = false;
  pick(event, true);
});
canvas.addEventListener('pointerleave', () => {
  isDragging = false;
  document.body.style.cursor = '';
});

startButton.addEventListener('click', () => document.querySelector('.globe-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
tierButton.addEventListener('click', () => setTier(!showAll));

function resize() {
  const rect = canvas.parentElement!.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(420, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
setTier(false);
showCard(null);

globeGroup.rotation.set(-0.18, -0.72, 0.02);

function animate() {
  requestAnimationFrame(animate);
  if (!isDragging) {
    globeGroup.rotation.y += velocityX;
    globeGroup.rotation.x += velocityY;
    velocityX = THREE.MathUtils.lerp(velocityX, 0.0016, 0.006);
    velocityY *= 0.96;
  }
  markerObjects.forEach(({ ring }, index) => {
    const s = 1 + Math.sin(performance.now() * 0.002 + index) * 0.07;
    ring.scale.setScalar(s);
  });
  renderer.render(scene, camera);
}
animate();
