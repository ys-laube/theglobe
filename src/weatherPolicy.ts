export type WeatherProviderPolicy = {
  readonly mode: 'static-fallback-only';
  readonly liveApiRequired: false;
  readonly backendRequired: false;
  readonly apiKeyRequired: false;
  readonly fallbackLabel: string;
  readonly fallbackSummary: string;
};

export const weatherPolicy = {
  mode: 'static-fallback-only',
  liveApiRequired: false,
  backendRequired: false,
  apiKeyRequired: false,
  fallbackLabel: '날씨 정보 준비 중',
  fallbackSummary: 'Weather is intentionally optional for this static gift app; never block the Korea family map on a live weather API, backend, or required API key.',
} as const satisfies WeatherProviderPolicy;

export function getWeatherFallbackCopy(policy: WeatherProviderPolicy = weatherPolicy) {
  return {
    label: policy.fallbackLabel,
    summary: policy.fallbackSummary,
  } as const;
}
