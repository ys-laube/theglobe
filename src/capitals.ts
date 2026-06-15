import { top100Cities, worldCapitals, type Top100CityEntry, type WorldCapitalEntry } from './data/cityData';

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
const foodsByRegion: Record<string, string> = {
  Asia: 'local markets and signature street food',
  Europe: 'classic cafés and regional plates',
  Africa: 'heritage spices and shared tables',
  'North America': 'city classics and neighborhood favorites',
  'South America': 'grilled plates and bright coastal flavors',
  Oceania: 'island produce and ocean-side dishes',
  Global: 'beloved local food and travel favorites',
};

function accentFor(index: number) {
  return accents[index % accents.length];
}

function capitalToMarker(entry: WorldCapitalEntry, index: number): Capital {
  return {
    id: `capital-${entry.id}`,
    city: entry.city,
    country: entry.country,
    region: entry.region,
    lat: entry.lat,
    lng: entry.lng,
    mode: 'capitals',
    landmark: `${entry.city} landmarks`,
    food: foodsByRegion[entry.region] ?? 'local food culture',
    note: `${entry.capitalOf}의 수도. 위키 링크로 더 자세히 탐험할 수 있어요.`,
    link: entry.link,
    accent: accentFor(index),
  };
}

function top100ToMarker(entry: Top100CityEntry, index: number): Capital {
  return {
    id: `top100-${entry.id}`,
    city: entry.city,
    country: entry.country,
    region: 'TOP100 인기 도시',
    lat: entry.lat,
    lng: entry.lng,
    mode: 'top100',
    rank: entry.rank,
    landmark: `${entry.city} highlights`,
    food: 'popular travel dining and local favorites',
    note: `TOP100 인기 도시 #${entry.rank}. 정적 검증 데이터로 순위와 링크를 제공합니다.`,
    link: entry.link,
    accent: accentFor(index + 3),
  };
}

export const capitalCities: Capital[] = worldCapitals.capitals.map(capitalToMarker);
export const top100PopularCities: Capital[] = top100Cities.cities.map(top100ToMarker);
export const capitals: Capital[] = [...capitalCities, ...top100PopularCities];
