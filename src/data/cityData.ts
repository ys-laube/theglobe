import worldCapitalsData from './worldCapitals.json';
import top100CitiesData from './top100Cities.json';

export type CitySourceMetadata = {
  id: string;
  name: string;
  url?: string;
  queryUrl?: string;
  extractedAt?: string;
  rankingYear?: number;
  rankingBasisYear?: number;
  rankingDate?: string;
  metric?: string;
  licenseUsageNote: string;
};

export type StaticCityEntry = {
  id: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  link: string;
  sourceId: string;
};

export type WorldCapitalEntry = StaticCityEntry & {
  capitalOf: string;
};

export type Top100CityEntry = StaticCityEntry & {
  rank: number;
};

export type WorldCapitalsDataset = {
  schemaVersion: 1;
  datasetId: string;
  source: CitySourceMetadata;
  inclusionRule: string;
  minimumRequiredCount: number;
  legacyBaselineCount: number;
  capitals: WorldCapitalEntry[];
};

export type Top100CitiesDataset = {
  schemaVersion: 1;
  datasetId: string;
  source: CitySourceMetadata;
  requiredCount: number;
  requiredRanks: '1-100-contiguous';
  cities: Top100CityEntry[];
};

export const worldCapitals = worldCapitalsData as WorldCapitalsDataset;
export const top100Cities = top100CitiesData as Top100CitiesDataset;
