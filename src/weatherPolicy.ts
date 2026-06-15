export type WeatherMode = 'simulated' | 'live' | 'unavailable';

export type WeatherPolicy = {
  readonly id: 'static-weather-policy-v1';
  readonly defaultMode: Extract<WeatherMode, 'simulated'>;
  readonly liveProvider: 'open-meteo';
  readonly liveEnhancementOptional: true;
  readonly requiresApiKey: false;
  readonly blocksInitialRender: false;
  readonly fallbackMode: Extract<WeatherMode, 'unavailable'>;
  readonly disclosureLabels: Readonly<Record<WeatherMode, string>>;
};

export const weatherPolicy = {
  id: 'static-weather-policy-v1',
  defaultMode: 'simulated',
  liveProvider: 'open-meteo',
  liveEnhancementOptional: true,
  requiresApiKey: false,
  blocksInitialRender: false,
  fallbackMode: 'unavailable',
  disclosureLabels: {
    simulated: 'Simulated weather ambience',
    live: 'Live Open-Meteo weather',
    unavailable: 'Weather unavailable; showing static ambience',
  },
} as const satisfies WeatherPolicy;

export function resolveWeatherMode({ liveEnabled, liveAvailable }: { liveEnabled: boolean; liveAvailable: boolean }): WeatherMode {
  if (!liveEnabled) return weatherPolicy.defaultMode;
  return liveAvailable ? 'live' : weatherPolicy.fallbackMode;
}
