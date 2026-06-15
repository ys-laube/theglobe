import * as THREE from 'three';
import { EARTH_ASSETS, EARTH_ASSET_TIMEOUT_MS, FALLBACK_ATTRIBUTION, shouldForcePrimaryTextureFailure, shouldForcePrimaryTextureTimeout } from './assetsPolicy';
import worldCountryBorders from './mapData/worldCountryBorders.json';

export type GlobeRuntimeState = 'boot' | 'loading-earth' | 'earth-ready' | 'fallback-earth' | 'asset-enhancement-ready';

type StateMeta = {
  failureReason?: string;
};

type StateListener = (state: GlobeRuntimeState, message: string, attribution: string, meta?: StateMeta) => void;

type BorderLineAsset = {
  readonly lines: readonly (readonly (readonly [number, number])[])[];
};

export type GlobeRenderer = {
  radius: number;
  addMarkerObjects: (...objects: THREE.Object3D[]) => void;
  setMarkerLayerVisible: (visible: boolean) => void;
  pickVisibleObject: (event: PointerEvent, target: HTMLElement) => THREE.Object3D | null;
  rotateBy: (deltaY: number, deltaX: number) => void;
  drift: (velocityY: number, velocityX: number) => void;
  animateMarkers: (now: number) => void;
  resize: () => void;
  render: () => void;
  loadEarth: () => Promise<void>;
  onStateChange: (listener: StateListener) => void;
  getState: () => GlobeRuntimeState;
};

const radius = 2;

function makeFallbackEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable for fallback Earth texture');

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, '#12345b');
  ocean.addColorStop(0.5, '#0a5f7d');
  ocean.addColorStop(1, '#061832');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const land = ['#2f7d4e', '#8aa05a', '#c0a36b', '#255c40'];
  const blobs = [
    [0.22, 0.35, 0.19, 0.24, -0.4], [0.32, 0.58, 0.11, 0.22, 0.6],
    [0.49, 0.37, 0.18, 0.16, -0.1], [0.56, 0.55, 0.12, 0.23, 0.3],
    [0.70, 0.36, 0.18, 0.22, 0.35], [0.78, 0.61, 0.12, 0.16, -0.2],
    [0.88, 0.70, 0.10, 0.13, 0.8],
  ];

  blobs.forEach(([x, y, sx, sy, skew], index) => {
    ctx.save();
    ctx.translate(x * canvas.width, y * canvas.height);
    ctx.rotate(skew);
    ctx.scale(sx * canvas.width, sy * canvas.height);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = (Math.PI * 2 * i) / 26;
      const r = 0.72 + 0.22 * Math.sin(i * 2.31 + index) + 0.10 * Math.cos(i * 4.7);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = land[index % land.length];
    ctx.fill();
    ctx.restore();
  });

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = '#dff9ff';
  ctx.lineWidth = 5;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    const y = (0.08 + i * 0.038) * canvas.height;
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 80) {
      ctx.lineTo(x, y + Math.sin(x * 0.008 + i) * 18);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then((value) => {
      window.clearTimeout(timeout);
      resolve(value);
    }, (error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

function loadTexture(loader: THREE.TextureLoader, url: string, label: string) {
  return withTimeout(loader.loadAsync(url), EARTH_ASSET_TIMEOUT_MS, label).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  });
}


function makeCountryBorderLayer(borderAsset: BorderLineAsset, borderRadius = radius + 0.031) {
  const positions: number[] = [];
  borderAsset.lines.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const [prevLat, prevLng] = line[index - 1];
      const [lat, lng] = line[index];
      if (Math.abs(lng - prevLng) > 180) continue;
      const a = latLngToVector(prevLat, prevLng, borderRadius);
      const b = latLngToVector(lat, lng, borderRadius);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: '#dbeafe',
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const borders = new THREE.LineSegments(geometry, material);
  borders.name = 'renderer-owned-country-borders';
  borders.frustumCulled = false;
  borders.renderOrder = 3;
  borders.userData.nonPickable = true;
  return borders;
}

function makeStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starPositions: number[] = [];
  for (let i = 0; i < 700; i++) {
    const r = 9 + Math.random() * 16;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  return new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#dbeafe', size: 0.018, transparent: true, opacity: 0.75 }));
}

export function createGlobeRenderer(canvas: HTMLCanvasElement, host: HTMLElement): GlobeRenderer {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 6.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const globeGroup = new THREE.Group();
  globeGroup.rotation.set(-0.18, -0.72, 0.02);
  scene.add(globeGroup);

  const globeMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.74,
    metalness: 0.03,
    emissive: '#07162a',
    emissiveIntensity: 0.18,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 128), globeMaterial);
  globeGroup.add(globe);

  const nightMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
  const night = new THREE.Mesh(new THREE.SphereGeometry(radius + 0.004, 128, 128), nightMaterial);
  globeGroup.add(night);

  const cloudMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius + 0.025, 96, 96), cloudMaterial);
  globeGroup.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius + 0.14, 96, 96),
    new THREE.MeshBasicMaterial({ color: '#68d4ff', transparent: true, opacity: 0.105, side: THREE.BackSide })
  );
  globeGroup.add(atmosphere);

  const countryBorders = makeCountryBorderLayer(worldCountryBorders as unknown as BorderLineAsset);
  countryBorders.visible = false;
  globeGroup.add(countryBorders);

  const markerGroup = new THREE.Group();
  markerGroup.visible = false;
  globeGroup.add(markerGroup);
  const pickables: THREE.Object3D[] = [];

  const lights = [
    new THREE.AmbientLight('#8fb6ff', 0.72),
    new THREE.DirectionalLight('#fff7ed', 3.7),
    new THREE.PointLight('#7dd3fc', 18, 9),
  ];
  (lights[1] as THREE.DirectionalLight).position.set(4, 3, 5);
  (lights[2] as THREE.PointLight).position.set(-3, -2, 4);
  scene.add(...lights, makeStars());

  const listeners: StateListener[] = [];
  let state: GlobeRuntimeState = 'boot';
  let stateMessage = 'Preparing the globe.';
  let attribution = EARTH_ASSETS.day.attribution;
  let failureReason: string | undefined;

  function emit(nextState: GlobeRuntimeState, message: string, nextAttribution = attribution, meta: StateMeta = {}) {
    state = nextState;
    stateMessage = message;
    attribution = nextAttribution;
    failureReason = meta.failureReason;
    host.dataset.earthState = state;
    countryBorders.visible = ['earth-ready', 'fallback-earth', 'asset-enhancement-ready'].includes(state);
    const detail = { state, message, attribution, failureReason };
    listeners.forEach((listener) => listener(state, stateMessage, attribution, detail));
    window.dispatchEvent(new CustomEvent('globe-state-change', { detail }));
  }

  async function loadEarth() {
    emit('loading-earth', 'Loading high-resolution Earth imagery…', EARTH_ASSETS.day.attribution);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    try {
      if (shouldForcePrimaryTextureFailure()) throw new Error('Forced Earth texture failure for QA');
      if (shouldForcePrimaryTextureTimeout()) await new Promise((_resolve, reject) => window.setTimeout(() => reject(new Error('Forced Earth texture timeout for QA')), EARTH_ASSET_TIMEOUT_MS + 80));
      const dayTexture = await loadTexture(loader, EARTH_ASSETS.day.url, EARTH_ASSETS.day.label);
      globeMaterial.map = dayTexture;
      globeMaterial.emissiveIntensity = 0.04;
      globeMaterial.needsUpdate = true;
      emit('earth-ready', 'Real Earth imagery loaded. Exploration is ready when you are.', EARTH_ASSETS.day.attribution);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown Earth texture load failure';
      globeMaterial.map = makeFallbackEarthTexture();
      globeMaterial.color.set('#ffffff');
      globeMaterial.emissiveIntensity = 0.10;
      globeMaterial.needsUpdate = true;
      emit('fallback-earth', 'High-resolution imagery is unavailable, so a designed fallback Earth is active.', FALLBACK_ATTRIBUTION, { failureReason: reason });
    }

    Promise.allSettled([
      loadTexture(loader, EARTH_ASSETS.clouds.url, EARTH_ASSETS.clouds.label).then((texture) => {
        cloudMaterial.map = texture;
        cloudMaterial.opacity = 0.34;
        cloudMaterial.needsUpdate = true;
      }),
      loadTexture(loader, EARTH_ASSETS.night.url, EARTH_ASSETS.night.label).then((texture) => {
        nightMaterial.map = texture;
        nightMaterial.opacity = 0.18;
        nightMaterial.needsUpdate = true;
      }),
    ]).then(() => {
      if (state === 'earth-ready') emit('asset-enhancement-ready', 'Earth imagery and optional atmosphere enhancements are active.', attribution);
    });
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(420, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    radius,
    addMarkerObjects: (...objects) => {
      markerGroup.add(...objects);
      pickables.push(...objects);
    },
    setMarkerLayerVisible: (visible) => {
      markerGroup.visible = visible;
    },
    pickVisibleObject: (event, target) => {
      const rect = target.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(pickables.filter((object) => object.visible), false)[0]?.object ?? null;
    },
    rotateBy: (deltaY, deltaX) => {
      globeGroup.rotation.y += deltaY;
      globeGroup.rotation.x += deltaX;
      globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x, -0.75, 0.75);
    },
    drift: (velocityY, velocityX) => {
      globeGroup.rotation.y += velocityY;
      globeGroup.rotation.x += velocityX;
    },
    animateMarkers: (now) => {
      markerGroup.children.forEach((child, index) => {
        if (child.type === 'Mesh' && child.visible && child.userData.capital) {
          const s = 1 + Math.sin(now * 0.002 + index) * 0.045;
          child.scale.setScalar(s);
        }
      });
    },
    resize,
    render: () => renderer.render(scene, camera),
    loadEarth,
    onStateChange: (listener) => {
      listeners.push(listener);
      listener(state, stateMessage, attribution);
    },
    getState: () => state,
  };
}

export function latLngToVector(lat: number, lng: number, r = radius + 0.045) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}
