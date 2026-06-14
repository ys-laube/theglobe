import * as THREE from 'three';
import { capitals, type Capital } from './capitals';
import type { GlobeRenderer, GlobeRuntimeState } from './globeRenderer';
import { latLngToVector } from './globeRenderer';

export type ExplorationOverlay = {
  setExplorationMode: (enabled: boolean) => void;
  getExplorationMode: () => boolean;
  setShowAll: (all: boolean) => void;
  handlePointerMove: (event: PointerEvent, dragging: boolean) => void;
  handlePointerUp: (event: PointerEvent, movedDistance: number) => void;
  updateState: (state: GlobeRuntimeState) => void;
};

type OverlayElements = {
  card: HTMLElement;
  explorationButton: HTMLButtonElement;
  tierButton: HTMLButtonElement;
  tierTitle: HTMLElement;
  tierCopy: HTMLElement;
  visibleCount: HTMLElement;
  regionList: HTMLElement;
};

const readyStates: GlobeRuntimeState[] = ['earth-ready', 'fallback-earth', 'asset-enhancement-ready'];

function makeMarker(capital: Capital, radius: number) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(capital.tier === 'highlight' ? 0.045 : 0.027, 18, 18),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.tier === 'highlight' ? 1 : 0.78 })
  );
  marker.position.copy(latLngToVector(capital.lat, capital.lng, radius + 0.045));
  marker.userData.capital = capital;

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(capital.tier === 'highlight' ? 0.108 : 0.082, 16, 16),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitArea.position.copy(marker.position);
  hitArea.userData.capital = capital;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(capital.tier === 'highlight' ? 0.075 : 0.045, capital.tier === 'highlight' ? 0.085 : 0.052, 32),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.tier === 'highlight' ? 0.58 : 0.24, side: THREE.DoubleSide })
  );
  ring.position.copy(marker.position.clone().multiplyScalar(1.002));
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  ring.userData.capital = capital;
  return { marker, ring, hitArea };
}

export function createExplorationOverlay(globe: GlobeRenderer, elements: OverlayElements): ExplorationOverlay {
  const markerObjects = capitals.map((capital) => ({ capital, ...makeMarker(capital, globe.radius) }));
  markerObjects.forEach(({ marker, ring, hitArea }) => {
    globe.markerGroup.add(marker, ring, hitArea);
    globe.pickables.push(marker, ring, hitArea);
  });

  let showAll = false;
  let explorationMode = false;
  let earthReady = false;
  let selected: Capital | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(99, 99);

  function visibleData() {
    if (!explorationMode || !earthReady) return [];
    return markerObjects.filter(({ capital }) => showAll || capital.tier === 'highlight').map(({ capital }) => capital);
  }

  function showCard(capital: Capital | null) {
    selected = capital;
    if (!capital) {
      elements.card.dataset.empty = 'true';
      elements.card.innerHTML = `<div class="card-art"><span>🌍</span></div><div class="card-copy"><p class="card-kicker">Exploration</p><h2>탐험 모드를 켜면 도시가 나타나요</h2><p>처음에는 지구의 표면과 분위기를 충분히 느끼고, 준비되면 수도의 이야기를 열어보세요.</p></div>`;
      return;
    }
    elements.card.dataset.empty = 'false';
    elements.card.style.setProperty('--accent', capital.accent);
    elements.card.innerHTML = `
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

  function syncUi() {
    const canShowMarkers = explorationMode && earthReady;
    globe.markerGroup.visible = canShowMarkers;
    markerObjects.forEach(({ capital, marker, ring, hitArea }) => {
      const visible = canShowMarkers && (showAll || capital.tier === 'highlight');
      marker.visible = visible;
      ring.visible = visible;
      hitArea.visible = visible;
    });

    const data = visibleData();
    elements.visibleCount.textContent = String(data.length);
    elements.tierTitle.textContent = !earthReady ? 'Earth loading' : explorationMode ? (showAll ? 'World capitals' : 'Premium highlights') : 'Earth-first gift mode';
    elements.tierCopy.textContent = !earthReady
      ? '지구 표면 또는 의도된 폴백이 준비될 때까지 핀과 카드는 숨겨둡니다.'
      : explorationMode
        ? (showAll ? '더 많은 나라와 수도를 탐색하되, 카드 내용은 짧고 안정적으로 유지합니다.' : '엄선된 수도부터 차분히 탐색합니다.')
        : '첫 화면은 건희, 민하, 찬희를 위한 진짜 지구 같은 인상을 먼저 보여줍니다.';
    elements.explorationButton.textContent = explorationMode ? '탐험 모드 닫기' : '탐험 모드 열기';
    elements.explorationButton.disabled = !earthReady;
    elements.tierButton.textContent = showAll ? '하이라이트만 보기' : '더 많은 수도 보기';
    elements.tierButton.disabled = !canShowMarkers;
    const byRegion = [...new Set(data.map((c) => c.region))];
    elements.regionList.innerHTML = byRegion.map((region) => `<span>${region}</span>`).join('');
    if ((!canShowMarkers || (selected && !data.includes(selected))) && selected) showCard(null);
  }

  function updatePointer(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(event: PointerEvent, commit = false) {
    if (!earthReady || !explorationMode) {
      document.body.style.cursor = '';
      return;
    }
    updatePointer(event);
    raycaster.setFromCamera(pointer, globe.camera);
    const hit = raycaster.intersectObjects(globe.pickables.filter((o) => o.visible), false)[0];
    document.body.style.cursor = hit ? 'pointer' : '';
    if (hit && commit) showCard(hit.object.userData.capital as Capital);
  }

  function setExplorationMode(enabled: boolean) {
    explorationMode = enabled && earthReady;
    showCard(null);
    syncUi();
  }

  elements.explorationButton.addEventListener('click', () => setExplorationMode(!explorationMode));
  elements.tierButton.addEventListener('click', () => {
    showAll = !showAll;
    syncUi();
  });
  showCard(null);
  syncUi();

  return {
    setExplorationMode,
    getExplorationMode: () => explorationMode,
    setShowAll: (all) => {
      showAll = all;
      syncUi();
    },
    handlePointerMove: (event, dragging) => {
      if (!dragging) pick(event, false);
    },
    handlePointerUp: (event, movedDistance) => {
      if (movedDistance <= 6) pick(event, true);
    },
    updateState: (state) => {
      earthReady = readyStates.includes(state);
      if (!earthReady) explorationMode = false;
      syncUi();
    },
  };
}
