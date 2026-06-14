import * as THREE from 'three';
import { capitals } from './capitals';
import { createExplorationOverlay } from './explorationOverlay';
import { createGlobeRenderer } from './globeRenderer';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <section class="hero" aria-label="선물 소개">
      <p class="eyebrow">A real Earth for bigger dreams</p>
      <h1>건희, 민하, 찬희에게</h1>
      <p class="message">세상은 넓고, 너희가 닿을 곳은 더 넓다. 먼저 지구를 천천히 바라보고, 준비되면 도시의 빛을 하나씩 열어보자.</p>
      <div class="actions">
        <button class="primary" data-action="start">지구본 열기</button>
        <button class="ghost" data-action="explore">탐험 모드 준비 중</button>
      </div>
    </section>

    <section class="globe-stage" aria-label="인터랙티브 3D 지구본" data-earth-state="boot">
      <canvas id="globe" aria-label="마우스나 터치로 회전 가능한 실제 지구 느낌의 3D 지구본"></canvas>
      <div class="halo"></div>
      <div class="earth-status" aria-live="polite">
        <strong data-state-label>Preparing Earth</strong>
        <span data-state-copy>Loading the globe renderer.</span>
      </div>
      <div class="hint">드래그해서 지구를 돌리고, 탐험 모드를 켠 뒤 수도를 눌러보세요</div>
      <article class="city-card" data-empty="true" aria-live="polite"></article>
    </section>

    <aside class="panel" aria-label="탐색 상태">
      <div>
        <p class="panel-label">Discovery mode</p>
        <h2 data-tier-title>Earth-first gift mode</h2>
        <p data-tier-copy>처음에는 건희, 민하, 찬희를 위한 진짜 지구 같은 인상을 먼저 보여줍니다.</p>
      </div>
      <div class="stats">
        <span><strong data-visible-count>0</strong> visible capitals</span>
        <span><strong>${new Set(capitals.map((c) => c.region)).size}</strong> regions</span>
      </div>
      <button class="ghost wide" data-action="toggle-tier" disabled>더 많은 수도 보기</button>
      <div class="region-list" data-region-list></div>
      <p class="asset-note" data-attribution>Earth imagery policy loading…</p>
    </aside>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#globe')!;
const stage = document.querySelector<HTMLElement>('.globe-stage')!;
const startButton = document.querySelector<HTMLButtonElement>('[data-action="start"]')!;
const explorationButton = document.querySelector<HTMLButtonElement>('[data-action="explore"]')!;
const tierButton = document.querySelector<HTMLButtonElement>('[data-action="toggle-tier"]')!;
const stateLabel = document.querySelector<HTMLElement>('[data-state-label]')!;
const stateCopy = document.querySelector<HTMLElement>('[data-state-copy]')!;
const attribution = document.querySelector<HTMLElement>('[data-attribution]')!;

const globe = createGlobeRenderer(canvas, stage);
const overlay = createExplorationOverlay(globe, {
  card: document.querySelector<HTMLElement>('.city-card')!,
  explorationButton,
  tierButton,
  tierTitle: document.querySelector<HTMLElement>('[data-tier-title]')!,
  tierCopy: document.querySelector<HTMLElement>('[data-tier-copy]')!,
  visibleCount: document.querySelector<HTMLElement>('[data-visible-count]')!,
  regionList: document.querySelector<HTMLElement>('[data-region-list]')!,
});

globe.onStateChange((state, message, credit) => {
  stateLabel.textContent = state.replaceAll('-', ' ');
  stateCopy.textContent = message;
  attribution.textContent = credit;
  overlay.updateState(state);
  (window as Window & { __GLOBE_QA__?: Record<string, unknown> }).__GLOBE_QA__ = {
    state,
    explorationMode: overlay.getExplorationMode(),
    forcedTextureMode: new URLSearchParams(window.location.search).get('earthTexture'),
  };
});

let isDragging = false;
let lastX = 0;
let lastY = 0;
let downX = 0;
let downY = 0;
let movedDistance = 0;
let velocityX = 0.0018;
let velocityY = 0;

canvas.addEventListener('pointerdown', (event) => {
  isDragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  downX = event.clientX;
  downY = event.clientY;
  movedDistance = 0;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (isDragging) {
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    movedDistance = Math.max(movedDistance, Math.hypot(event.clientX - downX, event.clientY - downY));
    if (movedDistance > 6) {
      globe.globeGroup.rotation.y += dx * 0.006;
      globe.globeGroup.rotation.x += dy * 0.0035;
      globe.globeGroup.rotation.x = THREE.MathUtils.clamp(globe.globeGroup.rotation.x, -0.75, 0.75);
      velocityX = dx * 0.00018;
      velocityY = dy * 0.00008;
    }
    lastX = event.clientX;
    lastY = event.clientY;
  }
  overlay.handlePointerMove(event, isDragging);
});

canvas.addEventListener('pointerup', (event) => {
  isDragging = false;
  overlay.handlePointerUp(event, movedDistance);
});

canvas.addEventListener('pointercancel', () => {
  isDragging = false;
  document.body.style.cursor = '';
});

canvas.addEventListener('pointerleave', () => {
  isDragging = false;
  document.body.style.cursor = '';
});

startButton.addEventListener('click', () => stage.scrollIntoView({ behavior: 'smooth', block: 'center' }));

function resize() {
  globe.resize();
}
window.addEventListener('resize', resize);
resize();

globe.loadEarth();

function animate() {
  requestAnimationFrame(animate);
  if (!isDragging) {
    globe.globeGroup.rotation.y += velocityX;
    globe.globeGroup.rotation.x += velocityY;
    velocityX = THREE.MathUtils.lerp(velocityX, 0.0016, 0.006);
    velocityY *= 0.96;
  }
  globe.markerGroup.children.forEach((child, index) => {
    if (child.type === 'Mesh' && child.visible && child.userData.capital) {
      const s = 1 + Math.sin(performance.now() * 0.002 + index) * 0.045;
      child.scale.setScalar(s);
    }
  });
  globe.render();
}
animate();
