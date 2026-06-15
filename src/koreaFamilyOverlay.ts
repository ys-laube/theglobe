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

type FamilyRouteSegment = {
  readonly id: string;
  readonly from: RegionId;
  readonly to: RegionId;
  readonly label: string;
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

const householdMarkers: readonly { readonly householdId: HouseholdId; readonly regionId: RegionId; readonly dx: number; readonly dy: number }[] = [
  { householdId: 'parents', regionId: 'kr-busan-haeundae-stylized', dx: -3.4, dy: -2.4 },
  { householdId: 'sister', regionId: 'kr-busan-haeundae-stylized', dx: 3.6, dy: 2.4 },
  { householdId: 'brother', regionId: 'kr-seoul-mapo-stylized', dx: 0, dy: -2.6 },
  { householdId: 'home', regionId: 'kr-gimhae-bonghwang-stylized', dx: 0, dy: 2.8 },
];

const familyRouteSegments: readonly FamilyRouteSegment[] = [
  { id: 'route-country-busan', from: 'kr-country-stylized', to: 'kr-busan-stylized', label: '대한민국에서 부산광역시로 이어지는 가족 경로' },
  { id: 'route-busan-haeundae', from: 'kr-busan-stylized', to: 'kr-busan-haeundae-stylized', label: '부산광역시에서 해운대구 가족 자리로 확대' },
  { id: 'route-country-seoul', from: 'kr-country-stylized', to: 'kr-seoul-stylized', label: '대한민국에서 서울특별시로 이어지는 가족 경로' },
  { id: 'route-seoul-mapo', from: 'kr-seoul-stylized', to: 'kr-seoul-mapo-stylized', label: '서울특별시에서 마포구 가족 자리로 확대' },
  { id: 'route-country-gyeongnam', from: 'kr-country-stylized', to: 'kr-gyeongnam-stylized', label: '대한민국에서 경상남도로 이어지는 가족 경로' },
  { id: 'route-gyeongnam-gimhae', from: 'kr-gyeongnam-stylized', to: 'kr-gyeongnam-gimhae-stylized', label: '경상남도에서 김해시로 확대' },
  { id: 'route-gimhae-bonghwang', from: 'kr-gyeongnam-gimhae-stylized', to: 'kr-gimhae-bonghwang-stylized', label: '김해시에서 봉황동 가족 자리로 확대' },
];

const activeRouteSegmentIdsByRegion: Record<RegionId, readonly string[]> = {
  'kr-country-stylized': [],
  'kr-busan-stylized': ['route-country-busan'],
  'kr-busan-haeundae-stylized': ['route-country-busan', 'route-busan-haeundae'],
  'kr-seoul-stylized': ['route-country-seoul'],
  'kr-seoul-mapo-stylized': ['route-country-seoul', 'route-seoul-mapo'],
  'kr-gyeongnam-stylized': ['route-country-gyeongnam'],
  'kr-gyeongnam-gimhae-stylized': ['route-country-gyeongnam', 'route-gyeongnam-gimhae'],
  'kr-gimhae-bonghwang-stylized': ['route-country-gyeongnam', 'route-gyeongnam-gimhae', 'route-gimhae-bonghwang'],
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

function centroidOf(id: RegionId) {
  return featureById(id).centroid;
}

function routePath(segment: FamilyRouteSegment) {
  const [x1, y1] = centroidOf(segment.from);
  const [x2, y2] = centroidOf(segment.to);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - Math.max(3, Math.abs(x2 - x1) * 0.12);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function selectedRouteSummary(region: RegionId) {
  const node = routeNodes[region];
  if (region === 'kr-country-stylized') return '17-region static overview · choose a family route';
  if (node.households?.length) return `${node.label} family target · cards and markers ready`;
  return `${node.label} route highlighted · continue the drilldown`;
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
    appendText(copy, 'p', 'Official static Korea family map', 'map-kicker');
    appendText(copy, 'h2', routeNodes[selectedRegion].label);
    appendText(copy, 'p', '공공데이터/VWorld 경계 데이터셋 메타데이터를 문서화한 정적 17개 광역 행정구역 안내에서 가족이 있는 자리까지 확대됩니다.');
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
    const activeRouteSegmentIds = new Set(activeRouteSegmentIdsByRegion[selectedRegion]);

    const routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    routeLayer.setAttribute('class', 'korea-family-route-layer');
    routeLayer.setAttribute('aria-hidden', 'true');
    familyRouteSegments.forEach((segment) => {
      const route = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      route.setAttribute('d', routePath(segment));
      route.setAttribute('class', ['korea-family-route', activeRouteSegmentIds.has(segment.id) ? 'is-active' : ''].filter(Boolean).join(' '));
      route.setAttribute('aria-label', segment.label);
      routeLayer.append(route);
    });
    svg.append(routeLayer);

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


    householdMarkers.forEach((markerModel) => {
      const feature = featureById(markerModel.regionId);
      const household = householdById(markerModel.householdId);
      const [cx, cy] = feature.centroid;
      const x = cx + markerModel.dx;
      const y = cy + markerModel.dy;
      const activeRegion = selectedRegion === markerModel.regionId;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', ['household-marker', activeRegion ? 'is-active' : ''].filter(Boolean).join(' '));
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${household.label} 열기`);
      const openMarker = () => {
        if (selectedRegion !== markerModel.regionId) setRegion(markerModel.regionId);
        setHousehold(markerModel.householdId);
      };
      group.addEventListener('click', openMarker);
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openMarker();
        }
      });

      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', String(x));
      glow.setAttribute('cy', String(y));
      glow.setAttribute('r', activeRegion ? '3.9' : '3.2');
      glow.setAttribute('class', 'household-marker-glow');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', activeRegion ? '1.35' : '1.05');
      dot.setAttribute('class', 'household-marker-dot');
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(y - 4.2));
      label.setAttribute('class', 'household-marker-label');
      label.textContent = household.label;
      group.append(glow, dot, label);
      svg.append(group);
    });

    const legend = document.createElement('div');
    legend.className = 'korea-map-legend';
    appendText(legend, 'strong', 'Static family overlay');
    appendText(legend, 'span', selectedRouteSummary(selectedRegion));
    appendText(legend, 'small', 'Bundled geometry · no live map API · decorative navigation');
    mapMount.append(svg, legend);
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

    if (!node.next.length) {
      appendText(routePanel, 'p', 'Official static region', 'map-kicker');
      appendText(routePanel, 'h3', `${node.label} 경계 가이드`);
      appendText(routePanel, 'p', '공식 공공데이터/VWorld 경계 데이터셋 메타데이터를 기준으로 문서화한 정적 SVG 안내 영역입니다. 가족 목적지가 있는 지역만 다음 단계로 확대됩니다.');
      return;
    }

    appendText(routePanel, 'p', selectedRegion === 'kr-country-stylized' ? '17 first-level regions' : 'Next stop', 'map-kicker');
    appendText(routePanel, 'h3', selectedRegion === 'kr-country-stylized' ? '대한민국 17개 광역 행정구역' : '가족이 있는 지역으로 한 단계 더 들어가기');
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
    selectedRegion = 'kr-korea-overview';
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
      selectedRegion = 'kr-korea-overview';
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
