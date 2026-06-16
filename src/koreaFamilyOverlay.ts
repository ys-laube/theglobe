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
  | 'kr-korea-overview'
  | 'kr-seoul'
  | 'kr-busan'
  | 'kr-daegu'
  | 'kr-incheon'
  | 'kr-gwangju'
  | 'kr-daejeon'
  | 'kr-ulsan'
  | 'kr-sejong'
  | 'kr-gyeonggi'
  | 'kr-gangwon'
  | 'kr-chungbuk'
  | 'kr-chungnam'
  | 'kr-jeonbuk'
  | 'kr-jeonnam'
  | 'kr-gyeongbuk'
  | 'kr-gyeongnam'
  | 'kr-jeju'
  | 'kr-seoul-mapo'
  | 'kr-busan-haeundae'
  | 'kr-gyeongnam-gimhae'
  | 'kr-gimhae-bonghwang';

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

const firstLevelRegionOrder = [
  'kr-seoul',
  'kr-busan',
  'kr-daegu',
  'kr-incheon',
  'kr-gwangju',
  'kr-daejeon',
  'kr-ulsan',
  'kr-sejong',
  'kr-gyeonggi',
  'kr-gangwon',
  'kr-chungbuk',
  'kr-chungnam',
  'kr-jeonbuk',
  'kr-jeonnam',
  'kr-gyeongbuk',
  'kr-gyeongnam',
  'kr-jeju',
] as const satisfies readonly RegionId[];

const routeNodes: Record<RegionId, RouteNode> = {
  'kr-korea-overview': {
    id: 'kr-korea-overview',
    label: '대한민국',
    next: firstLevelRegionOrder,
  },
  'kr-seoul': { id: 'kr-seoul', label: '서울특별시', next: ['kr-seoul-mapo'] },
  'kr-busan': { id: 'kr-busan', label: '부산광역시', next: ['kr-busan-haeundae'] },
  'kr-daegu': { id: 'kr-daegu', label: '대구광역시', next: [] },
  'kr-incheon': { id: 'kr-incheon', label: '인천광역시', next: [] },
  'kr-gwangju': { id: 'kr-gwangju', label: '광주광역시', next: [] },
  'kr-daejeon': { id: 'kr-daejeon', label: '대전광역시', next: [] },
  'kr-ulsan': { id: 'kr-ulsan', label: '울산광역시', next: [] },
  'kr-sejong': { id: 'kr-sejong', label: '세종특별자치시', next: [] },
  'kr-gyeonggi': { id: 'kr-gyeonggi', label: '경기도', next: [] },
  'kr-gangwon': { id: 'kr-gangwon', label: '강원특별자치도', next: [] },
  'kr-chungbuk': { id: 'kr-chungbuk', label: '충청북도', next: [] },
  'kr-chungnam': { id: 'kr-chungnam', label: '충청남도', next: [] },
  'kr-jeonbuk': { id: 'kr-jeonbuk', label: '전북특별자치도', next: [] },
  'kr-jeonnam': { id: 'kr-jeonnam', label: '전라남도', next: [] },
  'kr-gyeongbuk': { id: 'kr-gyeongbuk', label: '경상북도', next: [] },
  'kr-gyeongnam': { id: 'kr-gyeongnam', label: '경상남도', next: ['kr-gyeongnam-gimhae'] },
  'kr-jeju': { id: 'kr-jeju', label: '제주특별자치도', next: [] },
  'kr-busan-haeundae': { id: 'kr-busan-haeundae', label: '해운대구', next: [], households: ['sister', 'parents'] },
  'kr-seoul-mapo': { id: 'kr-seoul-mapo', label: '마포구', next: [], households: ['brother'] },
  'kr-gyeongnam-gimhae': { id: 'kr-gyeongnam-gimhae', label: '김해시', next: ['kr-gimhae-bonghwang'] },
  'kr-gimhae-bonghwang': { id: 'kr-gimhae-bonghwang', label: '봉황동', next: [], households: ['home'] },
};

const householdMarkers: readonly { readonly householdId: HouseholdId; readonly regionId: RegionId; readonly dx: number; readonly dy: number }[] = [
  { householdId: 'parents', regionId: 'kr-busan-haeundae', dx: -3.4, dy: -2.4 },
  { householdId: 'sister', regionId: 'kr-busan-haeundae', dx: 3.6, dy: 2.4 },
  { householdId: 'brother', regionId: 'kr-seoul-mapo', dx: 0, dy: -2.6 },
  { householdId: 'home', regionId: 'kr-gimhae-bonghwang', dx: 0, dy: 2.8 },
];

const familyRouteSegments: readonly FamilyRouteSegment[] = [
  { id: 'route-country-busan', from: 'kr-korea-overview', to: 'kr-busan', label: '대한민국에서 부산광역시로 이어지는 가족 경로' },
  { id: 'route-busan-haeundae', from: 'kr-busan', to: 'kr-busan-haeundae', label: '부산광역시에서 해운대구 가족 자리로 확대' },
  { id: 'route-country-seoul', from: 'kr-korea-overview', to: 'kr-seoul', label: '대한민국에서 서울특별시로 이어지는 가족 경로' },
  { id: 'route-seoul-mapo', from: 'kr-seoul', to: 'kr-seoul-mapo', label: '서울특별시에서 마포구 가족 자리로 확대' },
  { id: 'route-country-gyeongnam', from: 'kr-korea-overview', to: 'kr-gyeongnam', label: '대한민국에서 경상남도로 이어지는 가족 경로' },
  { id: 'route-gyeongnam-gimhae', from: 'kr-gyeongnam', to: 'kr-gyeongnam-gimhae', label: '경상남도에서 김해시로 확대' },
  { id: 'route-gimhae-bonghwang', from: 'kr-gyeongnam-gimhae', to: 'kr-gimhae-bonghwang', label: '김해시에서 봉황동 가족 자리로 확대' },
];

const familyTargetRegionOrder = [
  'kr-seoul-mapo',
  'kr-busan-haeundae',
  'kr-gyeongnam-gimhae',
  'kr-gimhae-bonghwang',
] as const satisfies readonly RegionId[];

function buildActiveRouteSegmentIdsByRegion() {
  const segmentByTarget = new Map<RegionId, FamilyRouteSegment>(familyRouteSegments.map((segment) => [segment.to, segment]));
  const activeEntries = (Object.keys(routeNodes) as RegionId[]).map((region) => {
    const routeIds: string[] = [];
    let cursor: RegionId | undefined = region;
    while (cursor) {
      const segment = segmentByTarget.get(cursor);
      if (!segment) break;
      routeIds.unshift(segment.id);
      cursor = segment.from;
    }
    return [region, routeIds] as const;
  });
  return Object.fromEntries(activeEntries) as unknown as Record<RegionId, readonly string[]>;
}

const activeRouteSegmentIdsByRegion = buildActiveRouteSegmentIdsByRegion();
const regionOrder: RegionId[] = [...firstLevelRegionOrder, ...familyTargetRegionOrder];

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
  if (id === 'kr-korea-overview') return [52, 50] as const;
  return featureById(id).centroid;
}

function routePath(segment: FamilyRouteSegment) {
  const [x1, y1] = centroidOf(segment.from);
  const [x2, y2] = centroidOf(segment.to);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - Math.max(3, Math.abs(x2 - x1) * 0.12);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function householdById(id: HouseholdId) {
  const household = householdConfig.households.find((candidate) => candidate.id === id);
  if (!household) throw new Error(`Missing household config: ${id}`);
  return household;
}

export function createKoreaFamilyOverlay({ host, onStateChange, onClose }: CreateOptions): KoreaFamilyOverlay {
  let openState = false;
  let selectedRegion: RegionId = 'kr-korea-overview';
  let selectedHousehold: HouseholdId | null = null;
  let highlightedRegion: RegionId | null = null;
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

  function syncHighlightState() {
    host.querySelectorAll<HTMLElement | SVGElement>('[data-region-id]').forEach((element) => {
      element.classList.toggle('is-highlighted', Boolean(highlightedRegion && element.dataset.regionId === highlightedRegion));
    });
  }

  function setHighlightedRegion(region: RegionId | null) {
    highlightedRegion = region;
    syncHighlightState();
  }

  function setRegion(region: RegionId) {
    highlightedRegion = null;
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
    appendText(copy, 'p', '17 광역자치단체', 'map-kicker');
    appendText(copy, 'h2', routeNodes[selectedRegion].label);
    appendText(copy, 'p', '가족이 있는 도시와 동네까지 차분히 이어지는 한국 지도입니다.');
    const breadcrumbs = document.createElement('div');
    breadcrumbs.className = 'korea-breadcrumbs';
    const rootButton = document.createElement('button');
    rootButton.type = 'button';
    rootButton.textContent = '대한민국';
    rootButton.disabled = selectedRegion === 'kr-korea-overview';
    rootButton.addEventListener('click', () => setRegion('kr-korea-overview'));
    breadcrumbs.append(rootButton);
    if (selectedRegion !== 'kr-korea-overview') {
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
      polygon.dataset.regionId = id;
      polygon.setAttribute('aria-label', isNext ? `${feature.nameKo}로 확대` : isSelected ? `${feature.nameKo} 선택됨` : feature.nameKo);
      if (isNext) {
        polygon.setAttribute('tabindex', '0');
        polygon.setAttribute('role', 'button');
        polygon.addEventListener('pointerenter', () => setHighlightedRegion(id));
        polygon.addEventListener('pointerleave', () => setHighlightedRegion(null));
        polygon.addEventListener('focus', () => setHighlightedRegion(id));
        polygon.addEventListener('blur', () => setHighlightedRegion(null));
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

    if (!node.next.length) {
      appendText(routePanel, 'p', '관할 기초자치단체', 'map-kicker');
      appendText(routePanel, 'h3', node.label);
      appendText(routePanel, 'p', '이 지역은 지금 단계에서 한눈에 둘러보는 카드로 남겨두고, 가족 목적지가 있는 곳만 더 깊게 열립니다.');
      return;
    }

    appendText(routePanel, 'p', selectedRegion === 'kr-korea-overview' ? '17 광역자치단체' : 'Next stop', 'map-kicker');
    appendText(routePanel, 'h3', selectedRegion === 'kr-korea-overview' ? '대한민국 17개 광역 행정구역' : '가족이 있는 지역으로 한 단계 더 들어가기');
    const choices = document.createElement('div');
    choices.className = 'route-choice-grid';
    node.next.forEach((nextId) => {
      const feature = featureById(nextId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'route-choice';
      button.dataset.regionId = nextId;
      button.addEventListener('pointerenter', () => setHighlightedRegion(nextId));
      button.addEventListener('pointerleave', () => setHighlightedRegion(null));
      button.addEventListener('focus', () => setHighlightedRegion(nextId));
      button.addEventListener('blur', () => setHighlightedRegion(null));
      appendText(button, 'strong', feature.nameKo);
      appendText(button, 'span', feature.nameEn);
      button.addEventListener('click', () => setRegion(nextId));
      choices.append(button);
    });
    routePanel.append(choices);
    syncHighlightState();
  }

  function renderHouseholdDetail(household: Household) {
    routePanel.replaceChildren();
    appendText(routePanel, 'p', 'Selected family', 'map-kicker');
    appendText(routePanel, 'h3', household.label);
    appendText(routePanel, 'p', household.locationLabel);

    const gate = document.createElement('form');
    gate.className = 'name-gate';
    gate.setAttribute('aria-label', `${household.label} 암구호 확인`);

    const label = document.createElement('label');
    label.textContent = '암구호를 대시오!';
    label.setAttribute('for', `name-gate-${household.id}`);
    const input = document.createElement('input');
    input.id = `name-gate-${household.id}`;
    input.name = 'family-passphrase';
    input.type = 'text';
    input.autocomplete = 'off';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary';
    submit.textContent = '암구호 확인';
    label.append(input);
    gate.prepend(label);
    gate.append(submit);

    const feedback = document.createElement('p');
    feedback.className = 'name-gate-feedback';
    feedback.setAttribute('aria-live', 'polite');
    if (nameGateState === 'invalid') feedback.textContent = '암구호 틀림';
    routePanel.append(gate, feedback);

    const links = document.createElement('div');
    links.className = 'band-link-grid';
    if (unlockedHousehold === household.id) {
      feedback.textContent = '암구호 확인 완료';
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
      highlightedRegion = null;
      selectedHousehold = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onStateChange();
    },
    close: () => {
      openState = false;
      highlightedRegion = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onClose?.();
      onStateChange();
    },
    getState: state,
  };
}
