import koreaFamilyBoundaries from './mapData/koreaFamilyBoundaries.json';
import { getHouseholdLinks, householdConfig, isAcceptedHouseholdName, type Household, type HouseholdId } from './householdConfig';

type BoundaryFeature = {
  readonly id: string;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly tier: string;
  readonly familyPathRole: string;
  readonly interactive: boolean;
  readonly polygon: readonly (readonly [number, number])[];
  readonly centroid: readonly [number, number];
};

type ReferenceLine = {
  readonly id: string;
  readonly label: string;
  readonly points: readonly (readonly [number, number])[];
};

type OverlayData = {
  readonly features: readonly BoundaryFeature[];
  readonly worldReferenceLines: readonly ReferenceLine[];
};

type RegionId =
  | 'kr-country-stylized'
  | 'kr-busan-stylized'
  | 'kr-busan-haeundae-stylized'
  | 'kr-seoul-stylized'
  | 'kr-seoul-mapo-stylized'
  | 'kr-gyeongnam-stylized'
  | 'kr-gyeongnam-gimhae-stylized'
  | 'kr-gimhae-bonghwang-stylized';

type OverlayState = {
  open: boolean;
  tier: string | null;
  selectedRegion: RegionId | null;
  selectedHousehold: HouseholdId | null;
  nameGateState: 'closed' | 'locked' | 'invalid' | 'unlocked';
  unlockedLinkCount: number;
};

type RouteNode = {
  readonly id: RegionId;
  readonly label: string;
  readonly next: readonly RegionId[];
  readonly households?: readonly HouseholdId[];
};

export type KoreaFamilyOverlay = {
  open: () => void;
  close: () => void;
  getState: () => OverlayState;
};

type CreateOptions = {
  host: HTMLElement;
  onStateChange: () => void;
  onClose?: () => void;
};

const routeNodes: Record<RegionId, RouteNode> = {
  'kr-country-stylized': {
    id: 'kr-country-stylized',
    label: '대한민국',
    next: ['kr-busan-stylized', 'kr-seoul-stylized', 'kr-gyeongnam-stylized'],
  },
  'kr-busan-stylized': {
    id: 'kr-busan-stylized',
    label: '부산광역시',
    next: ['kr-busan-haeundae-stylized'],
  },
  'kr-busan-haeundae-stylized': {
    id: 'kr-busan-haeundae-stylized',
    label: '해운대구',
    next: [],
    households: ['sister', 'parents'],
  },
  'kr-seoul-stylized': {
    id: 'kr-seoul-stylized',
    label: '서울특별시',
    next: ['kr-seoul-mapo-stylized'],
  },
  'kr-seoul-mapo-stylized': {
    id: 'kr-seoul-mapo-stylized',
    label: '마포구',
    next: [],
    households: ['brother'],
  },
  'kr-gyeongnam-stylized': {
    id: 'kr-gyeongnam-stylized',
    label: '경상남도',
    next: ['kr-gyeongnam-gimhae-stylized'],
  },
  'kr-gyeongnam-gimhae-stylized': {
    id: 'kr-gyeongnam-gimhae-stylized',
    label: '김해시',
    next: ['kr-gimhae-bonghwang-stylized'],
  },
  'kr-gimhae-bonghwang-stylized': {
    id: 'kr-gimhae-bonghwang-stylized',
    label: '봉황동',
    next: [],
    households: ['home'],
  },
};

const regionOrder: RegionId[] = [
  'kr-country-stylized',
  'kr-busan-stylized',
  'kr-busan-haeundae-stylized',
  'kr-seoul-stylized',
  'kr-seoul-mapo-stylized',
  'kr-gyeongnam-stylized',
  'kr-gyeongnam-gimhae-stylized',
  'kr-gimhae-bonghwang-stylized',
];

function appendText<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tagName: K, text: string, className?: string) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function polygonPoints(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function pathPoints(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}

function featureById(id: RegionId) {
  const data = koreaFamilyBoundaries as unknown as OverlayData;
  const feature = data.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Korea family boundary feature: ${id}`);
  return feature;
}

function householdById(id: HouseholdId) {
  const household = householdConfig.households.find((candidate) => candidate.id === id);
  if (!household) throw new Error(`Missing household config: ${id}`);
  return household;
}

export function createKoreaFamilyOverlay({ host, onStateChange, onClose }: CreateOptions): KoreaFamilyOverlay {
  let openState = false;
  let selectedRegion: RegionId = 'kr-country-stylized';
  let selectedHousehold: HouseholdId | null = null;
  let nameGateState: OverlayState['nameGateState'] = 'closed';
  let unlockedHousehold: HouseholdId | null = null;

  const header = document.createElement('div');
  header.className = 'korea-map-header';
  const mapMount = document.createElement('div');
  mapMount.className = 'korea-map-canvas';
  const routePanel = document.createElement('div');
  routePanel.className = 'korea-route-panel';

  const closeButton = document.createElement('button');
  closeButton.className = 'ghost korea-close';
  closeButton.type = 'button';
  closeButton.textContent = '지구본으로 돌아가기';

  host.classList.add('korea-map-overlay');
  host.hidden = true;
  host.setAttribute('aria-hidden', 'true');
  host.append(header, mapMount, routePanel);

  function state(): OverlayState {
    return {
      open: openState,
      tier: openState ? routeNodes[selectedRegion].label : null,
      selectedRegion: openState ? selectedRegion : null,
      selectedHousehold,
      nameGateState: openState ? nameGateState : 'closed',
      unlockedLinkCount: openState && selectedHousehold && unlockedHousehold === selectedHousehold ? getHouseholdLinks(selectedHousehold).length : 0,
    };
  }

  function setRegion(region: RegionId) {
    selectedRegion = region;
    selectedHousehold = null;
    nameGateState = 'closed';
    unlockedHousehold = null;
    render();
    onStateChange();
  }

  function setHousehold(householdId: HouseholdId) {
    selectedHousehold = householdId;
    nameGateState = 'locked';
    unlockedHousehold = null;
    renderHouseholdDetail(householdById(householdId));
    onStateChange();
  }

  function renderHeader() {
    header.replaceChildren();
    const copy = document.createElement('div');
    appendText(copy, 'p', 'Family map in Korea', 'map-kicker');
    appendText(copy, 'h2', routeNodes[selectedRegion].label);
    appendText(copy, 'p', '지구 위 한국에서 시작해, 가족이 서로를 기억하는 자리까지 천천히 확대됩니다.');
    const breadcrumbs = document.createElement('div');
    breadcrumbs.className = 'korea-breadcrumbs';
    const rootButton = document.createElement('button');
    rootButton.type = 'button';
    rootButton.textContent = '대한민국';
    rootButton.disabled = selectedRegion === 'kr-country-stylized';
    rootButton.addEventListener('click', () => setRegion('kr-country-stylized'));
    breadcrumbs.append(rootButton);
    if (selectedRegion !== 'kr-country-stylized') {
      const current = appendText(breadcrumbs, 'span', `› ${routeNodes[selectedRegion].label}`);
      current.setAttribute('aria-current', 'page');
    }
    copy.append(breadcrumbs);
    header.append(copy, closeButton);
  }

  function renderMap() {
    mapMount.replaceChildren();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '가족 경로 중심의 한국 지도');

    const data = koreaFamilyBoundaries as unknown as OverlayData;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <radialGradient id="korea-map-glow" cx="50%" cy="48%" r="58%">
        <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.20"/>
        <stop offset="62%" stop-color="#2563eb" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
      </radialGradient>`;
    svg.append(defs);
    const oceanGlow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    oceanGlow.setAttribute('x', '0');
    oceanGlow.setAttribute('y', '0');
    oceanGlow.setAttribute('width', '100');
    oceanGlow.setAttribute('height', '100');
    oceanGlow.setAttribute('fill', 'url(#korea-map-glow)');
    svg.append(oceanGlow);
    data.worldReferenceLines.forEach((line) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathPoints(line.points));
      path.setAttribute('class', 'korea-context-line');
      path.setAttribute('aria-label', line.label);
      svg.append(path);
    });

    const selectedNode = routeNodes[selectedRegion];
    const nextIds = new Set(selectedNode.next);
    const householdTarget = new Set<RegionId>(selectedNode.households ? [selectedRegion] : []);

    for (const id of regionOrder) {
      const feature = featureById(id);
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', polygonPoints(feature.polygon));
      const isSelected = id === selectedRegion;
      const isNext = nextIds.has(id);
      const isHouseholdTarget = householdTarget.has(id);
      polygon.setAttribute('class', ['korea-region', isSelected ? 'is-selected' : '', isNext ? 'is-next' : '', isHouseholdTarget ? 'has-households' : ''].filter(Boolean).join(' '));
      if (isNext) {
        polygon.setAttribute('tabindex', '0');
        polygon.setAttribute('role', 'button');
        polygon.setAttribute('aria-label', `${feature.nameKo}로 확대`);
        polygon.addEventListener('click', () => setRegion(id));
        polygon.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setRegion(id);
          }
        });
      }
      svg.append(polygon);

      if (isSelected || isNext) {
        const [x, y] = feature.centroid;
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(x));
        label.setAttribute('y', String(y));
        label.setAttribute('class', 'korea-map-label');
        label.textContent = feature.nameKo;
        svg.append(label);
      }
    }
    mapMount.append(svg);
  }

  function renderRoutePanel() {
    routePanel.replaceChildren();
    const node = routeNodes[selectedRegion];
    if (node.households?.length) {
      appendText(routePanel, 'p', 'Family homes', 'map-kicker');
      appendText(routePanel, 'h3', `${node.label}에 있는 가족`);
      const cards = document.createElement('div');
      cards.className = 'household-card-grid';
      node.households.forEach((householdId) => {
        const household = householdById(householdId);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'household-card';
        appendText(card, 'strong', household.label);
        appendText(card, 'span', household.locationLabel);
        appendText(card, 'em', '이름 확인 후 가족 밴드로 연결됩니다');
        card.addEventListener('click', () => setHousehold(household.id));
        cards.append(card);
      });
      routePanel.append(cards);
      return;
    }

    appendText(routePanel, 'p', 'Next stop', 'map-kicker');
    appendText(routePanel, 'h3', '가족이 있는 지역으로 한 단계 더 들어가기');
    const choices = document.createElement('div');
    choices.className = 'route-choice-grid';
    node.next.forEach((nextId) => {
      const feature = featureById(nextId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'route-choice';
      appendText(button, 'strong', feature.nameKo);
      appendText(button, 'span', feature.nameEn);
      button.addEventListener('click', () => setRegion(nextId));
      choices.append(button);
    });
    routePanel.append(choices);
  }

  function renderHouseholdDetail(household: Household) {
    routePanel.replaceChildren();
    appendText(routePanel, 'p', 'Selected family', 'map-kicker');
    appendText(routePanel, 'h3', household.label);
    appendText(routePanel, 'p', `${household.locationLabel} · 가족 이름을 한 번 확인하면 준비해 둔 네이버 밴드 초대 링크가 열립니다.`);

    const gate = document.createElement('form');
    gate.className = 'name-gate';
    gate.setAttribute('aria-label', `${household.label} 가족 이름 확인`);

    const label = document.createElement('label');
    label.textContent = '가족 이름';
    label.setAttribute('for', `name-gate-${household.id}`);
    const input = document.createElement('input');
    input.id = `name-gate-${household.id}`;
    input.name = 'family-name';
    input.type = 'text';
    input.autocomplete = 'name';
    input.placeholder = '예: 한유진';
    input.setAttribute('aria-describedby', `name-gate-help-${household.id}`);
    const help = appendText(gate, 'p', '로그인이나 개인정보 저장 없이, 이 화면에서만 가볍게 확인합니다.', 'name-gate-help');
    help.id = `name-gate-help-${household.id}`;
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary';
    submit.textContent = '초대 링크 열기';
    label.append(input);
    gate.prepend(label);
    gate.append(submit);

    const feedback = document.createElement('p');
    feedback.className = 'name-gate-feedback';
    feedback.setAttribute('aria-live', 'polite');
    if (nameGateState === 'invalid') feedback.textContent = '이름을 다시 확인해 주세요. 공백은 자동으로 무시됩니다.';
    routePanel.append(gate, feedback);

    const links = document.createElement('div');
    links.className = 'band-link-grid';
    if (unlockedHousehold === household.id) {
      feedback.textContent = '확인되었습니다. 가족 밴드 초대 링크를 선택하세요.';
      getHouseholdLinks(household.id).forEach((slot) => {
        const link = document.createElement('a');
        link.href = slot.placeholderHref;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.className = 'band-link';
        appendText(link, 'strong', slot.label);
        appendText(link, 'span', 'placeholder · 실제 링크로 교체 예정');
        links.append(link);
      });
      routePanel.append(links);
    }

    gate.addEventListener('submit', (event) => {
      event.preventDefault();
      if (isAcceptedHouseholdName(household.id, input.value)) {
        unlockedHousehold = household.id;
        nameGateState = 'unlocked';
      } else {
        unlockedHousehold = null;
        nameGateState = 'invalid';
      }
      renderHouseholdDetail(household);
      onStateChange();
    });

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'ghost wide';
    back.textContent = '다른 가족 카드 보기';
    back.addEventListener('click', () => {
      selectedHousehold = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      renderRoutePanel();
      onStateChange();
    });
    routePanel.append(back);
  }

  function render() {
    host.hidden = !openState;
    host.setAttribute('aria-hidden', String(!openState));
    if (!openState) return;
    renderHeader();
    renderMap();
    renderRoutePanel();
  }

  closeButton.addEventListener('click', () => {
    openState = false;
    selectedRegion = 'kr-country-stylized';
    selectedHousehold = null;
    nameGateState = 'closed';
    unlockedHousehold = null;
    render();
    onClose?.();
    onStateChange();
  });

  return {
    open: () => {
      openState = true;
      selectedRegion = 'kr-country-stylized';
      selectedHousehold = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onStateChange();
    },
    close: () => {
      openState = false;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onClose?.();
      onStateChange();
    },
    getState: state,
  };
}
