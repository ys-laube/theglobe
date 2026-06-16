import { cityContent, top100Cities, worldCapitals, type CityCardContent, type Top100CityEntry, type WorldCapitalEntry } from './data/cityData';

export type CityExplorationMode = 'capitals' | 'top100';

export type Capital = {
  id: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  mode: CityExplorationMode;
  rank?: number;
  landmark: string;
  food: string;
  note: string;
  link: string;
  accent: string;
};

const accents = ['#7dd3fc', '#f9a8d4', '#f87171', '#fbbf24', '#34d399', '#5eead4', '#fb923c', '#c4b5fd', '#93c5fd', '#bef264'];
function contentFor(mode: CityExplorationMode, id: string, region: string): CityCardContent {
  const override = cityContent.overrides[`${mode === 'capitals' ? 'capital' : 'top100'}:${id}`];
  if (override) return override;
  const modeFallbacks = cityContent.fallbacks[mode === 'capitals' ? 'capital' : 'top100'];
  return modeFallbacks?.[region] ?? modeFallbacks?.Global ?? {
    landmark: 'historic center or signature viewpoint',
    food: 'beloved local dish',
  };
}

function accentFor(index: number) {
  return accents[index % accents.length];
}

function capitalToMarker(entry: WorldCapitalEntry, index: number): Capital {
  const content = contentFor('capitals', entry.id, entry.region);
  return {
    id: `capital-${entry.id}`,
    city: entry.city,
    country: entry.country,
    region: entry.region,
    lat: entry.lat,
    lng: entry.lng,
    mode: 'capitals',
    landmark: content.landmark,
    food: content.food,
    note: `${entry.capitalOf}의 수도. 위키 링크로 더 자세히 탐험할 수 있어요.`,
    link: entry.link,
    accent: accentFor(index),
  };
}

function top100ToMarker(entry: Top100CityEntry, index: number): Capital {
  const content = contentFor('top100', entry.id, entry.region);
  return {
    id: `top100-${entry.id}`,
    city: entry.city,
    country: entry.country,
    region: 'TOP100 인기 도시',
    lat: entry.lat,
    lng: entry.lng,
    mode: 'top100',
    rank: entry.rank,
    landmark: content.landmark,
    food: content.food,
    note: `TOP100 인기 도시 #${entry.rank}. 정적 검증 데이터로 순위와 링크를 제공합니다.`,
    link: entry.link,
    accent: accentFor(index + 3),
  };
}

export const capitalCities: Capital[] = worldCapitals.capitals.map(capitalToMarker);
export const top100PopularCities: Capital[] = top100Cities.cities.map(top100ToMarker);
export const capitals: Capital[] = [...capitalCities, ...top100PopularCities];
