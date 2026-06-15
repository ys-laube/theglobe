import * as THREE from 'three';
import { capitalCities, top100PopularCities, type Capital, type CityExplorationMode } from './capitals';
import type { GlobeRenderer, GlobeRuntimeState } from './globeRenderer';
import { latLngToVector } from './globeRenderer';

export type ExplorationOverlay = {
  setExplorationMode: (enabled: boolean) => void;
  getExplorationMode: () => boolean;
  setCityMode: (mode: CityExplorationMode) => void;
  handlePointerMove: (event: PointerEvent, dragging: boolean) => void;
  handlePointerUp: (event: PointerEvent, movedDistance: number) => void;
  updateState: (state: GlobeRuntimeState) => void;
  getQaState: () => {
    cityMode: CityExplorationMode;
    visibleCityCount: number;
    top100GroupCount: number;
    selectedCityId: string | null;
    focusedCityId: string | null;
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

function rankBandLabel(rank: number) {
  const start = Math.floor((rank - 1) / 10) * 10 + 1;
  const end = start + 9;
  return `${start}-${end}`;
}

function makeMarker(capital: Capital, radius: number) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(capital.mode === 'top100' ? 0.024 : 0.03, 18, 18),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.mode === 'top100' ? 0.72 : 0.82 })
  );
  marker.position.copy(latLngToVector(capital.lat, capital.lng, radius + 0.045));
  marker.userData.capital = capital;

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(capital.mode === 'top100' ? 0.074 : 0.082, 16, 16),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitArea.position.copy(marker.position);
  hitArea.userData.capital = capital;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(capital.mode === 'top100' ? 0.038 : 0.045, capital.mode === 'top100' ? 0.046 : 0.052, 32),
    new THREE.MeshBasicMaterial({ color: capital.accent, transparent: true, opacity: capital.mode === 'top100' ? 0.22 : 0.28, side: THREE.DoubleSide })
  );
  ring.position.copy(marker.position.clone().multiplyScalar(1.002));
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  ring.userData.capital = capital;
  return { marker, ring, hitArea };
}

export function createExplorationOverlay(globe: GlobeRenderer, elements: OverlayElements): ExplorationOverlay {
  const cityData = [...capitalCities, ...top100PopularCities];
  const markerObjects = cityData.map((capital) => ({ capital, ...makeMarker(capital, globe.radius) }));
  markerObjects.forEach(({ marker, ring, hitArea }) => {
    globe.addMarkerObjects(marker, ring, hitArea);
  });

  let cityMode: CityExplorationMode = 'capitals';
  let explorationMode = false;
  let earthReady = false;
  let selected: Capital | null = null;
  let focused: Capital | null = null;

  function visibleData() {
    if (!explorationMode || !earthReady) return [];
    return markerObjects.filter(({ capital }) => capital.mode === cityMode).map(({ capital }) => capital);
  }

  function selectCity(capital: Capital | null, focusGlobe = false) {
    if (capital && focusGlobe) {
      focused = capital;
      globe.focusLatLng(capital.lat, capital.lng);
    }
    showCard(capital);
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
  }

  function syncUi() {
    const canShowMarkers = explorationMode && earthReady;
    globe.setMarkerLayerVisible(canShowMarkers);
    markerObjects.forEach(({ capital, marker, ring, hitArea }) => {
      const visible = canShowMarkers && capital.mode === cityMode;
      marker.visible = visible;
      ring.visible = visible;
      hitArea.visible = visible;
    });

    const data = visibleData();
    elements.card.hidden = !canShowMarkers;
    elements.card.setAttribute('aria-hidden', String(!canShowMarkers));
    elements.visibleCount.textContent = String(data.length);
    elements.tierTitle.textContent = !earthReady ? 'Earth loading' : explorationMode ? (cityMode === 'top100' ? 'TOP 100 인기 도시' : '세계의 수도') : 'Discovery mode';
    elements.tierCopy.textContent = !earthReady
      ? '지구 표면 또는 의도된 폴백이 준비될 때까지 핀과 카드는 숨겨둡니다.'
      : explorationMode
        ? (cityMode === 'top100' ? '여행 인기 도시 100곳을 순위와 함께 보여줍니다.' : '검증된 수도 전체를 처음부터 지구 위에 보여줍니다.')
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
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.cityId = capital.id;
          button.textContent = `${capital.rank}. ${capital.city}`;
          button.addEventListener('click', () => selectCity(capital, true));
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
    if (capital && commit) selectCity(capital, true);
  }

  function setExplorationMode(enabled: boolean) {
    explorationMode = enabled && earthReady;
    showCard(null);
    focused = null;
    syncUi();
  }

  elements.explorationButton.addEventListener('click', () => setExplorationMode(!explorationMode));
  elements.tierButton.addEventListener('click', () => {
    cityMode = cityMode === 'top100' ? 'capitals' : 'top100';
    syncUi();
  });
  showCard(null);
  syncUi();

  return {
    setExplorationMode,
    getExplorationMode: () => explorationMode,
    setCityMode: (mode) => {
      cityMode = mode;
      showCard(null);
      focused = null;
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
      focusedCityId: focused?.id ?? null,
    }),
  };
}
