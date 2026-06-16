import * as THREE from 'three';
import { capitalCities, top100PopularCities, type Capital, type CityExplorationMode } from './capitals';
import type { GlobeRenderer, GlobeRuntimeState } from './globeRenderer';
import { latLngToVector } from './globeRenderer';

export type ExplorationOverlay = {
  setExplorationMode: (enabled: boolean) => void;
  getExplorationMode: () => boolean;
  setCityMode: (mode: CityExplorationMode) => void;
  focusCityById: (cityId: string) => boolean;
  getSelectedCity: () => Capital | null;
  getLastFocus: () => { cityId: string; delta: number } | null;
  handlePointerMove: (event: PointerEvent, dragging: boolean) => void;
  handlePointerUp: (event: PointerEvent, movedDistance: number) => void;
  updateState: (state: GlobeRuntimeState) => void;
  getQaState: () => {
    cityMode: CityExplorationMode;
    visibleCityCount: number;
    top100GroupCount: number;
    selectedCityId: string | null;
    focusedCityId: string | null;
    selectedCityMarkerGlowVisible: boolean;
    selectedCityListHighlighted: boolean;
    selectedMarkerGlowCityId: string | null;
  };
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
const safeAccentPattern = /^#[0-9a-f]{6}$/i;

function safeAccent(accent: string) {
  return safeAccentPattern.test(accent) ? accent : '#60a5fa';
}

function safeExternalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`Unsupported city link protocol: ${parsed.protocol}`);
  return parsed.toString();
}

const top100BucketSize = 10;
const markerBaseScale = 1;
const selectedMarkerScale = 1.45;
const selectedRingScale = 1.9;

function top100BucketLabel(startRank: number) {
  return `${startRank}-${startRank + top100BucketSize - 1}`;
}

function appendText<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tagName: K, text: string, className?: string) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function setMeshOpacity(mesh: THREE.Mesh, opacity: number) {
  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((item) => { item.opacity = opacity; item.needsUpdate = true; });
    return;
  }
  material.opacity = opacity;
  material.needsUpdate = true;
}

function makeMarker(capital: Capital, radius: number) {
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: capital.accent,
    transparent: true,
    opacity: capital.mode === 'top100' ? 0.72 : 0.82,
  });
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(capital.mode === 'top100' ? 0.024 : 0.03, 18, 18),
    markerMaterial
  );
  marker.position.copy(latLngToVector(capital.lat, capital.lng, radius + 0.045));
  marker.userData.capital = capital;

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(capital.mode === 'top100' ? 0.074 : 0.082, 16, 16),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitArea.position.copy(marker.position);
  hitArea.userData.capital = capital;

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: capital.accent,
    transparent: true,
    opacity: capital.mode === 'top100' ? 0.22 : 0.28,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(capital.mode === 'top100' ? 0.038 : 0.045, capital.mode === 'top100' ? 0.046 : 0.052, 32),
    ringMaterial
  );
  ring.position.copy(marker.position.clone().multiplyScalar(1.002));
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  ring.userData.capital = capital;

  const selectedGlow = new THREE.Mesh(
    new THREE.RingGeometry(capital.mode === 'top100' ? 0.062 : 0.072, capital.mode === 'top100' ? 0.092 : 0.105, 40),
    new THREE.MeshBasicMaterial({
      color: capital.accent,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  selectedGlow.position.copy(marker.position.clone().multiplyScalar(1.004));
  selectedGlow.lookAt(new THREE.Vector3(0, 0, 0));
  selectedGlow.visible = false;
  selectedGlow.userData.capital = capital;
  selectedGlow.userData.selectedCityGlow = true;
  selectedGlow.userData.selectedMarkerGlow = true;
  selectedGlow.userData.renderOnly = true;
  return { marker, ring, hitArea, selectedGlow };
}

export function createExplorationOverlay(globe: GlobeRenderer, elements: OverlayElements): ExplorationOverlay {
  const cityData = [...capitalCities, ...top100PopularCities];
  const markerObjects = cityData.map((capital) => ({ capital, ...makeMarker(capital, globe.radius) }));
  markerObjects.forEach(({ marker, ring, hitArea, selectedGlow }) => {
    globe.addMarkerObjects(marker, ring, hitArea, selectedGlow);
  });

  let cityMode: CityExplorationMode = 'capitals';
  let explorationMode = false;
  let earthReady = false;
  let selected: Capital | null = null;
  let lastFocus: { cityId: string; delta: number } | null = null;

  function visibleData() {
    if (!explorationMode || !earthReady) return [];
    return markerObjects.filter(({ capital }) => capital.mode === cityMode).map(({ capital }) => capital);
  }

  function emitSelectionChange() {
    window.dispatchEvent(new CustomEvent('city-selection-change', { detail: { selected, lastFocus } }));
  }

  function showCard(capital: Capital | null) {
    selected = capital;
    elements.card.replaceChildren();
    if (!capital) {
      elements.card.dataset.empty = 'true';
      const art = document.createElement('div');
      art.className = 'card-art';
      appendText(art, 'span', '🌍');
      const copy = document.createElement('div');
      copy.className = 'card-copy';
      appendText(copy, 'p', 'Exploration', 'card-kicker');
      appendText(copy, 'h2', '탐험 모드를 켜면 도시가 나타나요');
      appendText(copy, 'p', '처음에는 지구의 표면과 분위기를 충분히 느끼고, 준비되면 수도의 이야기를 열어보세요.');
      elements.card.append(art, copy);
      emitSelectionChange();
      return;
    }
    elements.card.dataset.empty = 'false';
    const accent = safeAccent(capital.accent);
    elements.card.style.setProperty('--accent', accent);
    const art = document.createElement('div');
    art.className = 'card-art';
    art.style.setProperty('--accent', accent);
    appendText(art, 'span', capital.city.slice(0, 1));

    const copy = document.createElement('div');
    copy.className = 'card-copy';
    appendText(copy, 'p', `${capital.rank ? `#${capital.rank} · ` : ''}${capital.region} · ${capital.country}`, 'card-kicker');
    appendText(copy, 'h2', capital.rank ? `${capital.rank}. ${capital.city}` : capital.city);
    appendText(copy, 'p', capital.note);

    const details = document.createElement('dl');
    [
      ['Landmark', capital.landmark],
      ['Food', capital.food],
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      appendText(row, 'dt', label);
      appendText(row, 'dd', value);
      details.append(row);
    });
    copy.append(details);

    const link = appendText(copy, 'a', '더 알아보기 ↗');
    link.href = safeExternalUrl(capital.link);
    link.target = '_blank';
    link.rel = 'noreferrer';
    elements.card.append(art, copy);
    emitSelectionChange();
  }

  function focusCity(capital: Capital) {
    showCard(capital);
    const focus = globe.focusLocation(capital.lat, capital.lng);
    lastFocus = { cityId: capital.id, delta: focus.delta };
    syncUi();
    emitSelectionChange();
  }

  function syncUi() {
    const canShowMarkers = explorationMode && earthReady;
    globe.setMarkerLayerVisible(canShowMarkers);
    markerObjects.forEach(({ capital, marker, ring, hitArea, selectedGlow }) => {
      const visible = canShowMarkers && capital.mode === cityMode;
      const isSelected = selected?.id === capital.id;
      marker.visible = visible;
      ring.visible = visible;
      hitArea.visible = visible;
      selectedGlow.visible = visible && isSelected;
      setMeshOpacity(marker, isSelected ? 1 : (capital.mode === 'top100' ? 0.72 : 0.82));
      setMeshOpacity(ring, isSelected ? 0.72 : (capital.mode === 'top100' ? 0.22 : 0.28));
      setMeshOpacity(selectedGlow, isSelected ? 0.58 : 0);
    });

    const data = visibleData();
    elements.card.hidden = !canShowMarkers;
    elements.card.setAttribute('aria-hidden', String(!canShowMarkers));
    elements.visibleCount.textContent = String(data.length);
    elements.tierTitle.textContent = !earthReady ? 'Earth loading' : explorationMode ? (cityMode === 'top100' ? 'TOP 100 인기 도시' : '세계의 수도') : 'Discovery mode';
    elements.tierCopy.textContent = !earthReady
      ? '지구 표면 또는 의도된 폴백이 준비될 때까지 핀과 카드는 숨겨둡니다.'
      : explorationMode
        ? (cityMode === 'top100' ? '여행 인기 도시 100곳을 순위와 함께 보여줍니다.' : '전 세계 UN가입국의 수도를 보여줍니다')
        : '탐험 모드를 켜면 세계의 수도부터 차분히 펼쳐집니다.';
    elements.explorationButton.textContent = explorationMode ? '탐험 모드 닫기' : '탐험 모드 열기';
    elements.explorationButton.disabled = !earthReady;
    elements.tierButton.textContent = cityMode === 'top100' ? '수도 보기' : 'TOP 100 인기 도시 보기';
    elements.tierButton.disabled = !canShowMarkers;
    if (cityMode === 'top100') {
      const groups = Array.from({ length: 10 }, (_value, index) => {
        const startRank = index * top100BucketSize + 1;
        return data.filter((capital) => capital.rank && capital.rank >= startRank && capital.rank < startRank + top100BucketSize);
      });
      elements.regionList.replaceChildren(...groups.map((group, index) => {
        const startRank = index * top100BucketSize + 1;
        const groupElement = document.createElement('section');
        groupElement.className = 'rank-group';
        groupElement.dataset.rankGroup = top100BucketLabel(startRank);
        appendText(groupElement, 'h3', `Ranks ${top100BucketLabel(startRank)}`);
        const list = document.createElement('ol');
        group.forEach((capital) => {
          const item = document.createElement('li');
          item.dataset.cityId = capital.id;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'rank-city-button';
          button.dataset.action = 'focus-city';
          button.dataset.cityId = capital.id;
          if (selected?.id === capital.id) {
            item.classList.add('is-selected');
            button.classList.add('is-selected');
            button.setAttribute('aria-current', 'true');
          }
          appendText(button, 'span', `${capital.rank}. ${capital.city}`, 'rank-city');
          appendText(button, 'span', capital.country, 'rank-country');
          button.addEventListener('click', () => focusCity(capital));
          item.append(button);
          list.append(item);
        });
        groupElement.append(list);
        return groupElement;
      }));
    } else {
      const byRegion = [...new Set(data.map((c) => c.region))];
      elements.regionList.replaceChildren(...byRegion.map((region) => {
        const chip = document.createElement('span');
        chip.textContent = region;
        return chip;
      }));
    }
    if ((!canShowMarkers || (selected && !data.includes(selected))) && selected) showCard(null);
  }

  function pick(event: PointerEvent, commit = false) {
    if (!earthReady || !explorationMode) {
      document.body.style.cursor = '';
      return;
    }
    const hit = globe.pickVisibleObject(event, event.currentTarget as HTMLElement);
    const capital = hit?.userData.capital as Capital | undefined;
    document.body.style.cursor = capital ? 'pointer' : '';
    if (capital && commit) focusCity(capital);
  }

  function setExplorationMode(enabled: boolean) {
    explorationMode = enabled && earthReady;
    showCard(null);
    lastFocus = null;
    syncUi();
  }

  function focusCityById(cityId: string) {
    const match = markerObjects.find(({ capital }) => capital.id === cityId && capital.mode === cityMode);
    if (!match) return false;
    focusCity(match.capital);
    return true;
  }

  elements.explorationButton.addEventListener('click', () => setExplorationMode(!explorationMode));
  elements.tierButton.addEventListener('click', () => {
    cityMode = cityMode === 'top100' ? 'capitals' : 'top100';
    showCard(null);
    lastFocus = null;
    syncUi();
  });
  showCard(null);
  syncUi();

  return {
    setExplorationMode,
    getExplorationMode: () => explorationMode,
    getSelectedCity: () => selected,
    getLastFocus: () => lastFocus,
    focusCityById,
    setCityMode: (mode) => {
      cityMode = mode;
      showCard(null);
      lastFocus = null;
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
    getQaState: () => ({
      cityMode,
      visibleCityCount: visibleData().length,
      top100GroupCount: cityMode === 'top100' && explorationMode && earthReady ? elements.regionList.querySelectorAll('[data-rank-group]').length : 0,
      selectedCityId: selected?.id ?? null,
      focusedCityId: lastFocus?.cityId ?? null,
      selectedCityMarkerGlowVisible: Boolean(selected && markerObjects.some(({ capital, selectedGlow }) => capital.id === selected?.id && selectedGlow.visible)),
      selectedMarkerGlowCityId: selected?.id && markerObjects.some(({ capital, selectedGlow }) => capital.id === selected?.id && selectedGlow.visible) ? selected.id : null,
      selectedCityListHighlighted: Boolean(selected && elements.regionList.querySelector(`[data-action="focus-city"][data-city-id="${CSS.escape(selected?.id ?? '')}"].is-selected[aria-current="true"]`)),
    }),
  };
}
