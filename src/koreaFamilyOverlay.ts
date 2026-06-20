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
  readonly rings?: readonly (readonly (readonly [number, number])[])[];
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

const KOREA_MAP_SOURCE_VIEWBOX = '0 0 100 100';
const KOREA_MAP_RENDER_VIEWBOX = '0 0 100 124';
const KOREA_MAP_RENDER_WIDTH = 100;
const KOREA_MAP_RENDER_HEIGHT = 124;
// Vector-only contract: boundary coordinates stay normalized in the 0..100
// static source space while the render viewBox is taller. The visual layer uses
// a geometry-derived fit from the official overview regions instead of breakpoint
// specific manual offsets, so PC and mobile share one stable composition.
type BBox = { minX: number; minY: number; maxX: number; maxY: number };

const KOREA_VECTOR_FIT_CONFIG = {
  paddingLeft: 3,
  paddingRight: 3,
  paddingTop: 13,
  paddingBottom: 3,
} as const;

type KoreaVectorFit = {
  readonly strategy: 'geometry-auto-fit';
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly bounds: BBox;
  readonly fittedBounds: BBox;
};

let cachedKoreaVectorFit: KoreaVectorFit | null = null;

function roundFitValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function koreaVectorTransform() {
  const { translateX, translateY, scale } = getKoreaVectorFit();
  return `translate(${translateX} ${translateY}) scale(${scale})`;
}

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
  highlightedHouseholdId: HouseholdId | null;
  nameGateState: 'closed' | 'locked' | 'invalid' | 'unlocked';
  unlockedLinkCount: number;
};

type RouteNode = {
  readonly id: RegionId;
  readonly label: string;
  readonly next: readonly RegionId[];
  readonly parent?: RegionId;
  readonly households?: readonly HouseholdId[];
};

type RegionInfo = {
  readonly namuUrl: string;
  readonly landmark: string;
  readonly food: string;
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
  'kr-seoul': { id: 'kr-seoul', label: '서울특별시', next: ['kr-seoul-mapo'], parent: 'kr-korea-overview' },
  'kr-busan': { id: 'kr-busan', label: '부산광역시', next: ['kr-busan-haeundae'], parent: 'kr-korea-overview' },
  'kr-daegu': { id: 'kr-daegu', label: '대구광역시', next: [], parent: 'kr-korea-overview' },
  'kr-incheon': { id: 'kr-incheon', label: '인천광역시', next: [], parent: 'kr-korea-overview' },
  'kr-gwangju': { id: 'kr-gwangju', label: '광주광역시', next: [], parent: 'kr-korea-overview' },
  'kr-daejeon': { id: 'kr-daejeon', label: '대전광역시', next: [], parent: 'kr-korea-overview' },
  'kr-ulsan': { id: 'kr-ulsan', label: '울산광역시', next: [], parent: 'kr-korea-overview' },
  'kr-sejong': { id: 'kr-sejong', label: '세종특별자치시', next: [], parent: 'kr-korea-overview' },
  'kr-gyeonggi': { id: 'kr-gyeonggi', label: '경기도', next: [], parent: 'kr-korea-overview' },
  'kr-gangwon': { id: 'kr-gangwon', label: '강원특별자치도', next: [], parent: 'kr-korea-overview' },
  'kr-chungbuk': { id: 'kr-chungbuk', label: '충청북도', next: [], parent: 'kr-korea-overview' },
  'kr-chungnam': { id: 'kr-chungnam', label: '충청남도', next: [], parent: 'kr-korea-overview' },
  'kr-jeonbuk': { id: 'kr-jeonbuk', label: '전북특별자치도', next: [], parent: 'kr-korea-overview' },
  'kr-jeonnam': { id: 'kr-jeonnam', label: '전라남도', next: [], parent: 'kr-korea-overview' },
  'kr-gyeongbuk': { id: 'kr-gyeongbuk', label: '경상북도', next: [], parent: 'kr-korea-overview' },
  'kr-gyeongnam': { id: 'kr-gyeongnam', label: '경상남도', next: ['kr-gyeongnam-gimhae'], parent: 'kr-korea-overview' },
  'kr-jeju': { id: 'kr-jeju', label: '제주특별자치도', next: [], parent: 'kr-korea-overview' },
  'kr-busan-haeundae': { id: 'kr-busan-haeundae', label: '해운대구', next: [], parent: 'kr-busan', households: ['sister', 'parents'] },
  'kr-seoul-mapo': { id: 'kr-seoul-mapo', label: '마포구', next: [], parent: 'kr-seoul', households: ['brother'] },
  'kr-gyeongnam-gimhae': { id: 'kr-gyeongnam-gimhae', label: '김해시', next: ['kr-gimhae-bonghwang'], parent: 'kr-gyeongnam' },
  'kr-gimhae-bonghwang': { id: 'kr-gimhae-bonghwang', label: '봉황동', next: [], parent: 'kr-gyeongnam-gimhae', households: ['home'] },
};


const regionInfoById: Partial<Record<RegionId, RegionInfo>> = {
  'kr-seoul': { namuUrl: 'https://namu.wiki/w/서울특별시', landmark: '남산서울타워', food: '떡볶이' },
  'kr-busan': { namuUrl: 'https://namu.wiki/w/부산광역시', landmark: '해운대해수욕장', food: '돼지국밥' },
  'kr-gyeongnam': { namuUrl: 'https://namu.wiki/w/경상남도', landmark: '진해 경화역', food: '진주냉면' },
  'kr-daegu': { namuUrl: 'https://namu.wiki/w/대구광역시', landmark: '서문시장', food: '막창구이' },
  'kr-incheon': { namuUrl: 'https://namu.wiki/w/인천광역시', landmark: '인천 차이나타운', food: '짜장면' },
  'kr-gwangju': { namuUrl: 'https://namu.wiki/w/광주광역시', landmark: '국립아시아문화전당', food: '광주 상추튀김' },
  'kr-daejeon': { namuUrl: 'https://namu.wiki/w/대전광역시', landmark: '엑스포과학공원', food: '칼국수' },
  'kr-ulsan': { namuUrl: 'https://namu.wiki/w/울산광역시', landmark: '대왕암공원', food: '언양불고기' },
  'kr-sejong': { namuUrl: 'https://namu.wiki/w/세종특별자치시', landmark: '세종호수공원', food: '복숭아 디저트' },
  'kr-gyeonggi': { namuUrl: 'https://namu.wiki/w/경기도', landmark: '수원화성', food: '수원 왕갈비' },
  'kr-gangwon': { namuUrl: 'https://namu.wiki/w/강원특별자치도', landmark: '설악산', food: '막국수' },
  'kr-chungbuk': { namuUrl: 'https://namu.wiki/w/충청북도', landmark: '속리산 법주사', food: '올갱이국' },
  'kr-chungnam': { namuUrl: 'https://namu.wiki/w/충청남도', landmark: '공주 공산성', food: '게국지' },
  'kr-jeonbuk': { namuUrl: 'https://namu.wiki/w/전북특별자치도', landmark: '전주 한옥마을', food: '전주비빔밥' },
  'kr-jeonnam': { namuUrl: 'https://namu.wiki/w/전라남도', landmark: '순천만습지', food: '떡갈비' },
  'kr-gyeongbuk': { namuUrl: 'https://namu.wiki/w/경상북도', landmark: '불국사', food: '안동찜닭' },
  'kr-jeju': { namuUrl: 'https://namu.wiki/w/제주특별자치도', landmark: '성산일출봉', food: '흑돼지구이' },
};

const householdMarkers: readonly { readonly householdId: HouseholdId; readonly regionId: RegionId; readonly dx: number; readonly dy: number }[] = [
  { householdId: 'parents', regionId: 'kr-busan-haeundae', dx: -0.55, dy: -0.38 },
  { householdId: 'sister', regionId: 'kr-busan-haeundae', dx: 0.55, dy: 0.38 },
  { householdId: 'brother', regionId: 'kr-seoul-mapo', dx: 0, dy: -0.34 },
  { householdId: 'home', regionId: 'kr-gimhae-bonghwang', dx: 0, dy: 0.18 },
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
const renderableRegionSet = new Set<RegionId>(
  (Object.keys(routeNodes) as RegionId[]).filter((id) => id !== 'kr-korea-overview')
);

function visibleRegionIdsFor(region: RegionId): readonly RegionId[] {
  const ids = new Set<RegionId>(firstLevelRegionOrder);
  if (region === 'kr-korea-overview') return [...ids];

  ids.add(region);
  routeNodes[region].next.forEach((nextId) => ids.add(nextId));

  // Keep the active ancestor path available for context/toggle behavior, but
  // never leak unrelated family drilldown polygons into the first overview.
  let parent = routeNodes[region].parent;
  while (parent && parent !== 'kr-korea-overview') {
    ids.add(parent);
    parent = routeNodes[parent].parent;
  }

  return [...ids].filter((id) => renderableRegionSet.has(id));
}

function polygonArea(points: readonly (readonly [number, number])[]) {
  const doubledArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(doubledArea) / 2;
}

function appendText<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tagName: K, text: string, className?: string) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function closedRingPath(points: readonly (readonly [number, number])[]) {
  return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')} Z`;
}

function featurePath(feature: BoundaryFeature) {
  // Gift-map visual contract: render the primary administrative landmass only.
  // The source data can contain many tiny detached island rings; they read as
  // stray dots at this scale. Jeju remains visible because its primary polygon
  // is the island itself.
  return closedRingPath(feature.polygon);
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

function renderedFeaturePoints(feature: BoundaryFeature) {
  // Keep fit geometry identical to `featurePath()`: the visible gift map draws
  // the verified primary landmass polygon and suppresses tiny detached rings.
  return feature.polygon;
}

function bboxForFeatures(regionIds: readonly RegionId[]): BBox {
  const points = regionIds.flatMap((id) => [...renderedFeaturePoints(featureById(id))]);
  if (points.length === 0) throw new Error('Cannot fit Korea map without boundary points');
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function fitBounds(bounds: BBox): KoreaVectorFit {
  const availableWidth = KOREA_MAP_RENDER_WIDTH - KOREA_VECTOR_FIT_CONFIG.paddingLeft - KOREA_VECTOR_FIT_CONFIG.paddingRight;
  const availableHeight = KOREA_MAP_RENDER_HEIGHT - KOREA_VECTOR_FIT_CONFIG.paddingTop - KOREA_VECTOR_FIT_CONFIG.paddingBottom;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale = Math.min(availableWidth / width, availableHeight / height);
  const targetCenterX = KOREA_VECTOR_FIT_CONFIG.paddingLeft + availableWidth / 2;
  const targetCenterY = KOREA_VECTOR_FIT_CONFIG.paddingTop + availableHeight / 2;
  const sourceCenterX = bounds.minX + width / 2;
  const sourceCenterY = bounds.minY + height / 2;
  const translateX = targetCenterX - scale * sourceCenterX;
  const translateY = targetCenterY - scale * sourceCenterY;
  return {
    strategy: 'geometry-auto-fit',
    scale: roundFitValue(scale),
    translateX: roundFitValue(translateX),
    translateY: roundFitValue(translateY),
    bounds,
    fittedBounds: {
      minX: roundFitValue(translateX + scale * bounds.minX),
      minY: roundFitValue(translateY + scale * bounds.minY),
      maxX: roundFitValue(translateX + scale * bounds.maxX),
      maxY: roundFitValue(translateY + scale * bounds.maxY),
    },
  };
}

function getKoreaVectorFit() {
  cachedKoreaVectorFit ??= fitBounds(bboxForFeatures(firstLevelRegionOrder));
  return cachedKoreaVectorFit;
}

function balanceRenderedVectorLayer(vectorLayer: SVGGElement, mapCanvas: HTMLElement, fit: KoreaVectorFit) {
  const canvasRect = mapCanvas.getBoundingClientRect();
  const regionRects = [...vectorLayer.querySelectorAll<SVGPathElement>('.korea-region')].map((region) => region.getBoundingClientRect());
  if (!canvasRect.width || !canvasRect.height || regionRects.length === 0) return fit;

  const rendered = {
    left: Math.min(...regionRects.map((rect) => rect.left)),
    right: Math.max(...regionRects.map((rect) => rect.right)),
    top: Math.min(...regionRects.map((rect) => rect.top)),
  };
  const renderedCenterX = (rendered.left + rendered.right) / 2;
  const targetCenterX = canvasRect.left + canvasRect.width / 2;
  const targetTop = canvasRect.top + canvasRect.height * (KOREA_VECTOR_FIT_CONFIG.paddingTop / KOREA_MAP_RENDER_HEIGHT);
  const xUnitsPerPixel = KOREA_MAP_RENDER_WIDTH / canvasRect.width;
  const yUnitsPerPixel = KOREA_MAP_RENDER_HEIGHT / canvasRect.height;
  const translateX = roundFitValue(fit.translateX + (targetCenterX - renderedCenterX) * xUnitsPerPixel);
  const translateY = roundFitValue(fit.translateY + (targetTop - rendered.top) * yUnitsPerPixel);
  const balancedFit = {
    ...fit,
    translateX,
    translateY,
    fittedBounds: {
      minX: roundFitValue(translateX + fit.scale * fit.bounds.minX),
      minY: roundFitValue(translateY + fit.scale * fit.bounds.minY),
      maxX: roundFitValue(translateX + fit.scale * fit.bounds.maxX),
      maxY: roundFitValue(translateY + fit.scale * fit.bounds.maxY),
    },
  };
  vectorLayer.setAttribute('transform', `translate(${balancedFit.translateX} ${balancedFit.translateY}) scale(${balancedFit.scale})`);
  return balancedFit;
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
  let highlightedHouseholdId: HouseholdId | null = null;
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
  host.dataset.mapStyle = 'vector-satellite-inspired';
  host.dataset.mapPalette = 'deep-ocean-vector';
  host.dataset.mapContract = 'geometry-auto-fit';
  host.dataset.islandCoverage = 'none';
  host.dataset.familyTraces = 'hidden';
  mapMount.dataset.mapStyle = 'vector-satellite-inspired';
  mapMount.dataset.familyTraces = 'hidden';
  host.hidden = true;
  host.setAttribute('aria-hidden', 'true');
  host.append(header, mapMount, routePanel);

  function state(): OverlayState {
    return {
      open: openState,
      tier: openState ? routeNodes[selectedRegion].label : null,
      selectedRegion: openState ? selectedRegion : null,
      selectedHousehold,
      highlightedHouseholdId: openState ? highlightedHouseholdId : null,
      nameGateState: openState ? nameGateState : 'closed',
      unlockedLinkCount: openState && selectedHousehold && unlockedHousehold === selectedHousehold ? getHouseholdLinks(selectedHousehold).length : 0,
    };
  }

  function syncHighlightState() {
    const suppressSelectedParentLabel = Boolean(
      highlightedHouseholdId || (highlightedRegion && highlightedRegion !== selectedRegion)
    );
    host.querySelectorAll<HTMLElement | SVGElement>('[data-region-id]').forEach((element) => {
      element.classList.toggle('is-highlighted', Boolean(highlightedRegion && element.dataset.regionId === highlightedRegion));
      element.classList.toggle(
        'is-suppressed',
        element.classList.contains('is-parent-label') && element.dataset.regionId === selectedRegion && suppressSelectedParentLabel
      );
    });
    host.querySelectorAll<HTMLElement | SVGElement>('[data-household-id]').forEach((element) => {
      const householdId = element.dataset.householdId as HouseholdId | undefined;
      const isHighlighted = Boolean(highlightedHouseholdId && householdId === highlightedHouseholdId);
      const isSelected = Boolean(selectedHousehold && householdId === selectedHousehold);
      element.classList.toggle('is-highlighted', isHighlighted);
      element.classList.toggle('is-selected-household', isSelected);
    });
  }

  function setHighlightedRegion(region: RegionId | null) {
    highlightedRegion = region;
    syncHighlightState();
    onStateChange();
  }

  function setHighlightedHousehold(householdId: HouseholdId | null) {
    highlightedHouseholdId = householdId;
    syncHighlightState();
    onStateChange();
  }

  function setRegion(region: RegionId) {
    highlightedRegion = null;
    highlightedHouseholdId = null;
    selectedRegion = region;
    selectedHousehold = null;
    nameGateState = 'closed';
    unlockedHousehold = null;
    render();
    onStateChange();
  }

  function activateRegion(region: RegionId) {
    if (region === selectedRegion && routeNodes[region].parent) {
      setRegion(routeNodes[region].parent);
      return;
    }
    setRegion(region);
  }

  function setHousehold(householdId: HouseholdId) {
    selectedHousehold = householdId;
    highlightedHouseholdId = householdId;
    nameGateState = 'locked';
    unlockedHousehold = null;
    renderHouseholdDetail(householdById(householdId));
    syncHighlightState();
    onStateChange();
  }

  function renderHeader() {
    header.replaceChildren();
    const copy = document.createElement('div');
    appendText(copy, 'h2', routeNodes[selectedRegion].label);
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
    svg.setAttribute('viewBox', KOREA_MAP_RENDER_VIEWBOX);
    svg.dataset.sourceViewbox = KOREA_MAP_SOURCE_VIEWBOX;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '가족 경로 중심의 한국 지도');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <radialGradient id="korea-map-glow" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.12"/>
        <stop offset="64%" stop-color="#075985" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#03152f" stop-opacity="0.06"/>
      </radialGradient>
      <linearGradient id="korea-land-terrain" x1="18%" y1="10%" x2="86%" y2="92%">
        <stop offset="0%" stop-color="#bbf7d0" stop-opacity="0.64"/>
        <stop offset="43%" stop-color="#4ade80" stop-opacity="0.50"/>
        <stop offset="72%" stop-color="#16a34a" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="#14532d" stop-opacity="0.34"/>
      </linearGradient>
      <linearGradient id="korea-selected-terrain" x1="16%" y1="8%" x2="86%" y2="92%">
        <stop offset="0%" stop-color="#ecfccb" stop-opacity="0.78"/>
        <stop offset="58%" stop-color="#86efac" stop-opacity="0.60"/>
        <stop offset="100%" stop-color="#22c55e" stop-opacity="0.46"/>
      </linearGradient>
      <radialGradient id="korea-map-vignette" cx="50%" cy="48%" r="68%">
        <stop offset="58%" stop-color="#0f172a" stop-opacity="0"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0.74"/>
      </radialGradient>
      <filter id="korea-land-soft-shadow" x="-18%" y="-18%" width="136%" height="136%">
        <feDropShadow dx="0" dy="0.35" stdDeviation="0.42" flood-color="#020617" flood-opacity="0.55"/>
        <feDropShadow dx="0" dy="-0.12" stdDeviation="0.18" flood-color="#dcfce7" flood-opacity="0.16"/>
      </filter>`;
    svg.append(defs);
    const oceanGlow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    oceanGlow.setAttribute('x', '0');
    oceanGlow.setAttribute('y', '0');
    oceanGlow.setAttribute('width', String(KOREA_MAP_RENDER_WIDTH));
    oceanGlow.setAttribute('height', String(KOREA_MAP_RENDER_HEIGHT));
    oceanGlow.setAttribute('fill', 'url(#korea-map-glow)');
    svg.append(oceanGlow);
    const selectedNode = routeNodes[selectedRegion];
    const nextIds = new Set(selectedNode.next);
    const householdTarget = new Set<RegionId>(selectedNode.households ? [selectedRegion] : []);
    const familyTraceState = selectedNode.households?.length ? 'terminal' : 'hidden';
    host.dataset.familyTraces = familyTraceState;
    mapMount.dataset.familyTraces = familyTraceState;

    const vectorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    vectorLayer.setAttribute('class', 'korea-vector-layer');
    vectorLayer.setAttribute('transform', koreaVectorTransform());
    svg.append(vectorLayer);

    const paintOrder = [...visibleRegionIdsFor(selectedRegion)].sort((a, b) => polygonArea(featureById(b).polygon) - polygonArea(featureById(a).polygon));
    for (const id of paintOrder) {
      const feature = featureById(id);
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      polygon.setAttribute('d', featurePath(feature));
      const isSelected = id === selectedRegion;
      const isNext = nextIds.has(id);
      const isHouseholdTarget = householdTarget.has(id);
      polygon.setAttribute('class', ['korea-region', isSelected ? 'is-selected' : '', isNext ? 'is-next' : '', isHouseholdTarget ? 'has-households' : ''].filter(Boolean).join(' '));
      polygon.dataset.regionId = id;
      polygon.setAttribute('aria-label', isNext ? `${feature.nameKo}로 확대` : isSelected ? `${feature.nameKo} 선택됨` : feature.nameKo);
      const isToggleTarget = isSelected && Boolean(selectedNode.parent);
      if (isNext || isToggleTarget) {
        polygon.setAttribute('tabindex', '0');
        polygon.setAttribute('role', 'button');
        polygon.addEventListener('pointerenter', () => setHighlightedRegion(id));
        polygon.addEventListener('pointerleave', () => setHighlightedRegion(null));
        polygon.addEventListener('focus', () => setHighlightedRegion(id));
        polygon.addEventListener('blur', () => setHighlightedRegion(null));
        polygon.addEventListener('click', () => activateRegion(id));
        polygon.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activateRegion(id);
          }
        });
      }
      vectorLayer.append(polygon);

      const shouldPinSelectedLabel = isSelected && selectedRegion !== 'kr-korea-overview';
      if (shouldPinSelectedLabel || isNext) {
        const [x, y] = feature.centroid;
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(x));
        label.setAttribute('y', String(y));
        label.setAttribute('class', ['korea-map-label', shouldPinSelectedLabel ? 'is-selected-label' : 'is-next-label', shouldPinSelectedLabel ? 'is-parent-label' : ''].filter(Boolean).join(' '));
        label.dataset.regionId = id;
        label.textContent = feature.nameKo;
        vectorLayer.append(label);
      }
    }



    if (familyTraceState === 'terminal') {
      householdMarkers.forEach((markerModel) => {
        const feature = featureById(markerModel.regionId);
        const household = householdById(markerModel.householdId);
        const [cx, cy] = feature.centroid;
        const x = cx + markerModel.dx;
        const y = cy + markerModel.dy;
        const activeRegion = selectedRegion === markerModel.regionId;
        const isSelectedHousehold = selectedHousehold === markerModel.householdId;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', ['household-marker', activeRegion ? 'is-active' : '', isSelectedHousehold ? 'is-selected-household' : ''].filter(Boolean).join(' '));
        group.dataset.householdId = markerModel.householdId;
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('aria-label', `${household.label} 지도 포인트`);
        const openMarker = () => {
          if (selectedRegion !== markerModel.regionId) setRegion(markerModel.regionId);
          setHousehold(markerModel.householdId);
        };
        group.addEventListener('pointerenter', () => setHighlightedHousehold(markerModel.householdId));
        group.addEventListener('pointerleave', () => setHighlightedHousehold(null));
        group.addEventListener('focus', () => setHighlightedHousehold(markerModel.householdId));
        group.addEventListener('blur', () => setHighlightedHousehold(null));
        group.addEventListener('click', openMarker);
        group.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMarker();
          }
        });

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));
        dot.setAttribute('r', activeRegion ? '0.72' : '0.58');
        dot.setAttribute('class', 'household-marker-dot');
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(x));
        label.setAttribute('y', String(y - 4.2));
        label.setAttribute('class', 'household-marker-label');
        label.textContent = household.label;
        group.append(dot, label);
        vectorLayer.append(group);
      });
    }

    const vignette = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    vignette.setAttribute('x', '0');
    vignette.setAttribute('y', '0');
    vignette.setAttribute('width', String(KOREA_MAP_RENDER_WIDTH));
    vignette.setAttribute('height', String(KOREA_MAP_RENDER_HEIGHT));
    vignette.setAttribute('class', 'korea-map-vignette');
    vignette.setAttribute('fill', 'url(#korea-map-vignette)');
    vignette.setAttribute('aria-hidden', 'true');
    svg.append(vignette);

    const fit = getKoreaVectorFit();
    mapMount.append(svg);
    const balancedFit = balanceRenderedVectorLayer(vectorLayer, mapMount, fit);
    mapMount.dataset.mapPalette = host.dataset.mapPalette ?? 'deep-ocean-vector';
    mapMount.dataset.mapContract = host.dataset.mapContract ?? 'geometry-auto-fit';
    mapMount.dataset.islandCoverage = host.dataset.islandCoverage ?? 'none';
    mapMount.dataset.fitStrategy = balancedFit.strategy;
    mapMount.dataset.fitScale = String(balancedFit.scale);
    mapMount.dataset.fitBounds = `${balancedFit.fittedBounds.minX},${balancedFit.fittedBounds.minY},${balancedFit.fittedBounds.maxX},${balancedFit.fittedBounds.maxY}`;
  }

  function renderRegionInfo(node: RouteNode, regionInfo: RegionInfo) {
    const section = document.createElement('section');
    section.className = 'region-info-section';
    appendText(section, 'p', '관할 기초자치단체', 'map-kicker');
    appendText(section, 'h3', node.label);
    const details = document.createElement('dl');
    details.className = 'region-info-list';
    appendText(details, 'dt', 'Landmark');
    appendText(details, 'dd', regionInfo.landmark);
    appendText(details, 'dt', 'Food');
    appendText(details, 'dd', regionInfo.food);
    const link = document.createElement('a');
    link.href = regionInfo.namuUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'region-info-link';
    link.textContent = '나무위키에서 더 보기 ↗';
    section.append(details, link);
    routePanel.append(section);
  }

  function renderNextStep(node: RouteNode) {
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
      button.addEventListener('click', () => activateRegion(nextId));
      choices.append(button);
    });
    routePanel.append(choices);
    syncHighlightState();
  }

  function renderHouseholdCards(node: RouteNode) {
    appendText(routePanel, 'p', 'Family homes', 'map-kicker');
    appendText(routePanel, 'h3', `${node.label}에 있는 가족`);
    const cards = document.createElement('div');
    cards.className = 'household-card-grid';
    node.households?.forEach((householdId) => {
      const household = householdById(householdId);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = ['household-card', selectedHousehold === household.id ? 'is-selected-household' : ''].filter(Boolean).join(' ');
      card.dataset.householdId = household.id;
      card.addEventListener('pointerenter', () => setHighlightedHousehold(household.id));
      card.addEventListener('pointerleave', () => setHighlightedHousehold(null));
      card.addEventListener('focus', () => setHighlightedHousehold(household.id));
      card.addEventListener('blur', () => setHighlightedHousehold(null));
      appendText(card, 'strong', household.label);
      appendText(card, 'span', household.locationLabel);
      card.addEventListener('click', () => setHousehold(household.id));
      cards.append(card);
    });
    routePanel.append(cards);
  }

  function renderRoutePanel() {
    routePanel.replaceChildren();
    const node = routeNodes[selectedRegion];
    const regionInfo = regionInfoById[selectedRegion];
    if (regionInfo) renderRegionInfo(node, regionInfo);
    if (node.next.length) {
      renderNextStep(node);
      return;
    }
    if (node.households?.length) {
      renderHouseholdCards(node);
      return;
    }
    if (!regionInfo) {
      appendText(routePanel, 'p', '관할 기초자치단체', 'map-kicker');
      appendText(routePanel, 'h3', node.label);
      appendText(routePanel, 'p', '가족 목적지가 있는 곳만 더 깊게 열립니다.');
    }
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
        link.href = slot.href;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.className = 'band-link';
        appendText(link, 'strong', slot.label);
        appendText(link, 'span', '가족 밴드 열기 ↗');
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
      setRegion('kr-korea-overview');
    });
    routePanel.append(back);
  }

  function render() {
    host.hidden = !openState;
    host.setAttribute('aria-hidden', String(!openState));
    if (!openState) {
      host.dataset.familyTraces = 'hidden';
      mapMount.dataset.familyTraces = 'hidden';
      return;
    }
    renderHeader();
    renderMap();
    renderRoutePanel();
  }

  closeButton.addEventListener('click', () => {
    openState = false;
    selectedRegion = 'kr-korea-overview';
    selectedHousehold = null;
    highlightedHouseholdId = null;
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
      highlightedHouseholdId = null;
      selectedHousehold = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onStateChange();
    },
    close: () => {
      openState = false;
      highlightedRegion = null;
      highlightedHouseholdId = null;
      nameGateState = 'closed';
      unlockedHousehold = null;
      render();
      onClose?.();
      onStateChange();
    },
    getState: state,
  };
}
