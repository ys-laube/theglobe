export type EarthAsset = {
  id: string;
  label: string;
  url: string;
  attribution: string;
  required: boolean;
};

export type NasaGibsWmsImageRequest = {
  layer: string;
  width: number;
  height: number;
  format: 'image/jpeg' | 'image/png';
  bbox: readonly [number, number, number, number];
};

export const EARTH_ASSET_TIMEOUT_MS = 6500;

export const NASA_GIBS_BLUE_MARBLE = {
  id: 'nasa-gibs-bluemarble-nextgeneration-wms',
  label: 'NASA GIBS BlueMarble Next Generation WMS image',
  endpoint: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
  layer: 'BlueMarble_NextGeneration',
  format: 'image/jpeg',
  srs: 'EPSG:4326',
  width: 2048,
  height: 1024,
  bbox: [-180, -90, 180, 90],
  attribution: 'Earth imagery: NASA Global Imagery Browse Services (GIBS), BlueMarble_NextGeneration.',
  sourceUrl: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
} as const;


export const EARTH_ASSETS = {
  day: {
    id: NASA_GIBS_BLUE_MARBLE.id,
    label: NASA_GIBS_BLUE_MARBLE.label,
    url: buildNasaGibsBlueMarbleWmsUrl(),
    attribution: NASA_GIBS_BLUE_MARBLE.attribution,
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

export function buildNasaGibsBlueMarbleWmsUrl(request: Partial<NasaGibsWmsImageRequest> = {}) {
  const width = request.width ?? NASA_GIBS_BLUE_MARBLE.width;
  const height = request.height ?? NASA_GIBS_BLUE_MARBLE.height;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    FORMAT: request.format ?? NASA_GIBS_BLUE_MARBLE.format,
    TRANSPARENT: 'false',
    LAYERS: request.layer ?? NASA_GIBS_BLUE_MARBLE.layer,
    STYLES: 'default',
    SRS: NASA_GIBS_BLUE_MARBLE.srs,
    WIDTH: String(width),
    HEIGHT: String(height),
    BBOX: (request.bbox ?? NASA_GIBS_BLUE_MARBLE.bbox).join(','),
  });
  return `${NASA_GIBS_BLUE_MARBLE.endpoint}?${params.toString()}`;
}

export function loadImageViaGet(url: string, label: string, timeoutMs = EARTH_ASSET_TIMEOUT_MS) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      image.src = '';
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error(`${label} failed to load via GET image request`));
    };
    image.src = url;
  });
}

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
