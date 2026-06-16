export type EarthAsset = {
  id: string;
  label: string;
  url: string;
  attribution: string;
  required: boolean;
};

export const EARTH_ASSET_TIMEOUT_MS = 6500;

export const EARTH_ASSETS = {
  day: {
    id: 'earth-day-threejs-nasa-derived',
    label: 'Earth day surface texture',
    url: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    attribution: 'Earth surface texture prepared for this family globe experience.',
    required: true,
  },
  clouds: {
    id: 'earth-clouds-threejs',
    label: 'Cloud enhancement texture',
    url: 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
    attribution: 'Soft cloud layer prepared for this family globe experience.',
    required: false,
  },
  night: {
    id: 'earth-night-threejs',
    label: 'Night lights texture',
    url: 'https://threejs.org/examples/textures/planets/earth_lights_2048.png',
    attribution: 'Subtle night-lights layer prepared for this family globe experience.',
    required: false,
  },
} satisfies Record<string, EarthAsset>;

export const FALLBACK_ATTRIBUTION = 'Primary Earth imagery unavailable; showing a locally generated fallback Earth with ocean, continent, and cloud-like detail.';

export function getTextureQaMode(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get('earthTexture') ?? params.get('texture');
}

export function shouldForcePrimaryTextureFailure() {
  return getTextureQaMode() === 'fail';
}

export function shouldForcePrimaryTextureTimeout() {
  return getTextureQaMode() === 'timeout';
}
