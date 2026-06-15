import { resolveWeatherMode, weatherPolicy, type WeatherMode } from './weatherPolicy';

type WeatherState = {
  readonly mode: WeatherMode;
  readonly label: string;
  readonly summary: string;
  readonly temperatureC?: number;
  readonly windKmh?: number;
};

type WeatherOptions = {
  host: HTMLElement;
  panel: HTMLElement;
  onStateChange: () => void;
};

const liveWeatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,wind_speed_10m&timezone=Asia%2FSeoul';
const liveTimeoutMs = 1800;

function liveRequested() {
  const weather = new URLSearchParams(window.location.search).get('weather');
  return weather === 'live' || weather === 'auto';
}

function formatSummary(state: WeatherState) {
  if (state.mode === 'live' && Number.isFinite(state.temperatureC) && Number.isFinite(state.windKmh)) {
    return `Seoul now · ${Math.round(state.temperatureC!)}°C · wind ${Math.round(state.windKmh!)} km/h`;
  }
  return state.summary;
}

function renderLayer(host: HTMLElement, mode: WeatherMode) {
  host.dataset.weatherMode = mode;
  host.replaceChildren();
  const band = document.createElement('div');
  band.className = 'weather-band';
  const motes = document.createElement('div');
  motes.className = 'weather-motes';
  for (let index = 0; index < 18; index += 1) {
    const mote = document.createElement('span');
    mote.style.setProperty('--i', String(index));
    motes.append(mote);
  }
  host.append(band, motes);
}

function renderPanel(panel: HTMLElement, state: WeatherState) {
  panel.replaceChildren();
  const kicker = document.createElement('p');
  kicker.className = 'panel-label';
  kicker.textContent = 'Weather ambience';
  const title = document.createElement('strong');
  title.textContent = state.label;
  const summary = document.createElement('span');
  summary.textContent = formatSummary(state);
  const disclosure = document.createElement('em');
  disclosure.textContent = state.mode === 'live'
    ? 'No key · Open-Meteo optional enhancement'
    : state.mode === 'unavailable'
      ? 'Live weather failed or timed out; static layer remains.'
      : 'Static first render; add ?weather=live to try live data.';
  panel.append(kicker, title, summary, disclosure);
}

function stateFor(mode: WeatherMode, live?: { temperatureC: number; windKmh: number }): WeatherState {
  const label = weatherPolicy.disclosureLabels[mode];
  if (mode === 'live' && live) {
    return { mode, label, summary: 'Live Seoul weather loaded.', temperatureC: live.temperatureC, windKmh: live.windKmh };
  }
  if (mode === 'unavailable') {
    return { mode, label, summary: 'A calm, static atmosphere stays visible while live weather is unavailable.' };
  }
  return { mode, label, summary: 'Soft cloud bands and particles are simulated so the gift never depends on a live API.' };
}

async function fetchLiveWeather(signal: AbortSignal) {
  const response = await fetch(liveWeatherUrl, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
  const data = await response.json() as { current?: { temperature_2m?: number; wind_speed_10m?: number } };
  const temperatureC = data.current?.temperature_2m;
  const windKmh = data.current?.wind_speed_10m;
  if (!Number.isFinite(temperatureC) || !Number.isFinite(windKmh)) throw new Error('Open-Meteo response missing current weather fields');
  return { temperatureC: temperatureC!, windKmh: windKmh! };
}

export function createWeatherAmbience({ host, panel, onStateChange }: WeatherOptions) {
  let state = stateFor(weatherPolicy.defaultMode);

  function apply(nextState: WeatherState) {
    state = nextState;
    renderLayer(host, state.mode);
    renderPanel(panel, state);
    onStateChange();
  }

  apply(state);

  if (liveRequested()) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), liveTimeoutMs);
    fetchLiveWeather(controller.signal)
      .then((live) => apply(stateFor(resolveWeatherMode({ liveEnabled: true, liveAvailable: true }), live)))
      .catch(() => apply(stateFor(resolveWeatherMode({ liveEnabled: true, liveAvailable: false }))))
      .finally(() => window.clearTimeout(timeout));
  }

  return {
    getState: () => state,
  };
}
