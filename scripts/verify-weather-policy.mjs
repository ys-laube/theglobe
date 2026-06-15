import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataProvenance = JSON.parse(await readFile(join(root, 'src/mapData/dataProvenance.json'), 'utf8'));
const policySource = await readFile(join(root, 'src/weatherPolicy.ts'), 'utf8');
const ambienceSource = await readFile(join(root, 'src/weatherAmbience.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const weather = dataProvenance.weather;
assert(weather.baselineMode === 'simulated-static', 'provenance weather baseline must be simulated/static');
assert(weather.liveEnhancement === 'optional-open-meteo-no-key-only', 'provenance live weather must be optional no-key Open-Meteo only');
assert(weather.requiredFallback === 'simulated-or-unavailable-with-disclosure', 'provenance fallback disclosure must be locked');
assert(weather.uiDisclosureRequired === true, 'weather UI disclosure must be required');
assert(weather.approvedSources.some((source) => source.id === 'open-meteo-forecast-api' && source.url === 'https://open-meteo.com/en/docs'), 'Open-Meteo docs source must be approved');
assert(weather.forbiddenBehavior.includes('required live weather for first render'), 'weather policy must forbid required live first render');
assert(weather.forbiddenBehavior.includes('secret key or paid endpoint in client bundle'), 'weather policy must forbid client secrets');

assert(policySource.includes("id: 'static-weather-policy-v1'"), 'weather policy id must be stable');
assert(policySource.includes("defaultMode: 'simulated'"), 'weather policy default mode must be simulated');
assert(policySource.includes("liveProvider: 'open-meteo'"), 'weather policy live provider must be Open-Meteo');
assert(policySource.includes('liveEnhancementOptional: true'), 'weather live enhancement must be optional');
assert(policySource.includes('requiresApiKey: false'), 'weather policy must not require an API key');
assert(policySource.includes('blocksInitialRender: false'), 'weather policy must not block initial render');
assert(policySource.includes("fallbackMode: 'unavailable'"), 'weather forced failure must resolve to unavailable fallback');
assert(policySource.includes('Simulated weather ambience'), 'simulated disclosure label is required');
assert(policySource.includes('Live Open-Meteo weather'), 'live disclosure label is required');
assert(policySource.includes('Weather unavailable; showing static ambience'), 'unavailable disclosure label is required');
assert(policySource.includes("return liveAvailable ? 'live' : weatherPolicy.fallbackMode"), 'weather mode resolver must gracefully fallback on live failure');
assert(!/api[_-]?key\s*[:=]\s*['\"][^'\"]+/i.test(policySource), 'weather policy must not include client API keys');
assert(!policySource.includes('fetch('), 'weather policy must not perform live fetches directly');
assert(!policySource.includes('import.meta.env'), 'weather policy must not read client env secrets');

assert(ambienceSource.includes('api.open-meteo.com/v1/forecast'), 'weather ambience must use the approved Open-Meteo no-key endpoint only');
assert(ambienceSource.includes('liveRequested()'), 'live weather must be explicitly opt-in from URL state');
assert(ambienceSource.includes("weather === 'live' || weather === 'auto'"), 'live weather must be limited to ?weather=live or ?weather=auto');
assert(ambienceSource.includes('liveTimeoutMs = 1800'), 'live weather must stay non-blocking with a short timeout');
assert(ambienceSource.includes('apply(state);'), 'weather ambience must render simulated state before any live fetch');
assert(ambienceSource.includes("cache: 'no-store'"), 'live weather fetch must not create stale runtime data assumptions');
assert(ambienceSource.includes('resolveWeatherMode({ liveEnabled: true, liveAvailable: false })'), 'live weather failures must resolve through the policy fallback');
assert(!/api[_-]?key/i.test(ambienceSource), 'weather ambience must not include or request API keys');
assert(!ambienceSource.includes('import.meta.env'), 'weather ambience must not read client env secrets');

console.log('PASS weather policy validation (simulated default, optional no-key live, graceful fallback)');
