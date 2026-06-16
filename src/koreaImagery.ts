import { KOREA_GIBS_BLUE_MARBLE } from './assetsPolicy';

export { KOREA_GIBS_BLUE_MARBLE };

export type KoreaImageryState = 'loading' | 'ready' | 'fallback' | 'error';
export type KoreaImagerySource = 'nasa-gibs-blue-marble-wms' | 'static-fallback';

export function buildKoreaGibsImageUrl(width = KOREA_GIBS_BLUE_MARBLE.width, height = KOREA_GIBS_BLUE_MARBLE.height) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: KOREA_GIBS_BLUE_MARBLE.layer,
    FORMAT: KOREA_GIBS_BLUE_MARBLE.format,
    CRS: KOREA_GIBS_BLUE_MARBLE.crs,
    BBOX: KOREA_GIBS_BLUE_MARBLE.bbox.join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
  });
  return `${KOREA_GIBS_BLUE_MARBLE.endpoint}?${params.toString()}`;
}

export function shouldForceKoreaImageryFallback() {
  return new URLSearchParams(window.location.search).get('koreaImagery') === 'fail'
    || Boolean(window.__KOREA_IMAGERY_FORCE_FALLBACK__);
}

declare global {
  interface Window {
    __KOREA_IMAGERY_FORCE_FALLBACK__?: boolean;
  }
}
