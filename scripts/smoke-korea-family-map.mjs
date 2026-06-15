import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const appPort = Number(process.env.SMOKE_APP_PORT ?? 4175);
const debugPort = Number(process.env.SMOKE_CHROME_DEBUG_PORT ?? 9225);
const chromeBin = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appUrl = `http://127.0.0.1:${appPort}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while the local preview server starts.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnProcess(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function terminate(child) {
  if (!child || child.killed) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      resolve();
    }, 1200).unref();
  });
}

async function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  return {
    send(method, params = {}) {
      const callId = ++id;
      socket.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() {
      socket.close();
    },
  };
}

let preview;
let chrome;
let profileDir;

try {
  preview = spawnProcess('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(appPort), '--strictPort']);
  await waitForHttp(appUrl);

  profileDir = await mkdtemp(join(tmpdir(), 'theglobe-chrome-'));
  chrome = spawnProcess(chromeBin, [
    '--headless=new',
    '--disable-gpu',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ]);
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);

  const newPageResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`, { method: 'PUT' });
  const page = await newPageResponse.json();
  const client = await cdp(page.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await delay(1000);

  const smoke = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: String.raw`
      (async () => {
        const waitFor = async (predicate, label) => {
          const deadline = Date.now() + 12000;
          while (Date.now() < deadline) {
            const value = predicate();
            if (value) return value;
            await new Promise((resolve) => setTimeout(resolve, 120));
          }
          throw new Error('Timed out waiting for ' + label);
        };
        const readyStates = new Set(['earth-ready', 'fallback-earth', 'asset-enhancement-ready']);
        await waitFor(() => readyStates.has(window.__GLOBE_QA__?.state), 'earth ready state');
        const clickButtonByStrong = async (text) => {
          const button = await waitFor(
            () => [...document.querySelectorAll('button')].find((candidate) => candidate.querySelector('strong')?.textContent?.trim() === text || candidate.textContent?.includes(text)),
            'button ' + text
          );
          button.click();
        };

        const bodyText = document.body.textContent ?? '';
        const rejectedCopy = [
          'Earth-first gift mode',
          '첫 화면은 건희, 민하, 찬희를 위한 진짜 지구',
          '6 region',
          'Korea family map',
          '더 많은 수도 보기',
        ].filter((text) => bodyText.includes(text));
        const koreaButtonPresent = Boolean(document.querySelector('[data-action="korea-family"]'));

        const exploreButton = await waitFor(() => document.querySelector('[data-action="explore"]:not(:disabled)'), 'exploration button');
        exploreButton.click();
        await waitFor(() => document.querySelector('[data-visible-count]')?.textContent?.trim() === '54', 'all capitals visible');
        const capitalsTitle = document.querySelector('[data-tier-title]')?.textContent?.trim();
        const capitalsCopy = document.querySelector('[data-tier-copy]')?.textContent?.trim();
        const top100Toggle = document.querySelector('[data-action="toggle-tier"]');
        const toggleLabelBefore = top100Toggle?.textContent?.trim();
        top100Toggle.click();
        await waitFor(() => document.querySelector('[data-visible-count]')?.textContent?.trim() === '100', 'TOP100 visible');
        const top100Title = document.querySelector('[data-tier-title]')?.textContent?.trim();
        const toggleLabelAfter = top100Toggle?.textContent?.trim();
        const top100Count = document.querySelector('[data-visible-count]')?.textContent?.trim();

        window.dispatchEvent(new CustomEvent('korea-family-map-request'));
        await waitFor(() => window.__GLOBE_QA__?.viewMode === 'korea-focus', 'Korea focus view mode');
        await waitFor(() => window.__GLOBE_QA__?.koreaOverlayOpen === true || document.querySelector('.korea-map-host')?.hidden === false, 'same-stage Korea map');
        await clickButtonByStrong('부산광역시');
        await waitFor(() => window.__GLOBE_QA__?.selectedRegion === 'kr-busan-stylized', 'Busan tier');
        await clickButtonByStrong('해운대구');
        await waitFor(() => window.__GLOBE_QA__?.selectedRegion === 'kr-busan-haeundae-stylized', 'Haeundae tier');
        const householdMarkerCount = document.querySelectorAll('.household-marker').length;
        await clickButtonByStrong('건희민하찬희네');
        await waitFor(() => window.__GLOBE_QA__?.selectedHousehold === 'sister', 'sister household');
        const input = document.querySelector('.name-gate input');
        input.value = '박건희';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.name-gate').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitFor(() => window.__GLOBE_QA__?.nameGateState === 'unlocked', 'name gate unlock');
        const links = [...document.querySelectorAll('.band-link')].map((link) => link.href);

        return {
          qa: window.__GLOBE_QA__,
          rejectedCopy,
          koreaButtonPresent,
          capitalsTitle,
          capitalsCopy,
          toggleLabelBefore,
          top100Title,
          toggleLabelAfter,
          count: top100Count,
          panelHasStatsLanguage: /regions|visible capitals|Premium highlights/.test(bodyText),
          cityCardPresent: Boolean(document.querySelector('.city-card')),
          stageKoreaMode: document.querySelector('.globe-stage')?.getAttribute('data-korea-mode'),
          koreaOverlayOpen: window.__GLOBE_QA__?.koreaOverlayOpen,
          viewMode: window.__GLOBE_QA__?.viewMode,
          selectedRegion: window.__GLOBE_QA__?.selectedRegion,
          mapCanvasPresent: Boolean(document.querySelector('.korea-map-canvas svg')),
          contextLineCount: document.querySelectorAll('.korea-context-line').length,
          householdMarkerCount,
          selectedHousehold: window.__GLOBE_QA__?.selectedHousehold,
          nameGateState: window.__GLOBE_QA__?.nameGateState,
          linkCount: links.length,
          links,
        };
      })()
    `,
  });
  await client.close();

  if (smoke.exceptionDetails) {
    throw new Error(`Browser smoke failed: ${smoke.exceptionDetails.text ?? JSON.stringify(smoke.exceptionDetails)}`);
  }
  const result = smoke.result.value;
  if (!result) throw new Error(`Browser smoke returned no serializable result: ${JSON.stringify(smoke)}`);
  if (result.rejectedCopy.length) throw new Error(`Rejected copy still present: ${result.rejectedCopy.join(', ')}`);
  if (result.koreaButtonPresent) throw new Error('Expected primary Korea family button to be removed');
  if (result.capitalsTitle !== '세계의 수도') throw new Error(`Expected capitals title, found ${result.capitalsTitle}`);
  if (!result.capitalsCopy.includes('검증된 수도 전체')) throw new Error(`Expected all-capitals copy, found ${result.capitalsCopy}`);
  if (result.toggleLabelBefore !== 'TOP 100 인기 도시 보기') throw new Error(`Expected TOP100 toggle label, found ${result.toggleLabelBefore}`);
  if (result.top100Title !== 'TOP 100 인기 도시') throw new Error(`Expected TOP100 title, found ${result.top100Title}`);
  if (result.toggleLabelAfter !== '수도 보기') throw new Error(`Expected return-to-capitals toggle label, found ${result.toggleLabelAfter}`);
  if (result.count !== '100') throw new Error(`Expected 100 TOP100 cities, found ${result.count}`);
  if (result.panelHasStatsLanguage) throw new Error('Expected old stats/premium panel language to be removed');
  if (!result.cityCardPresent) throw new Error('Expected existing city card surface to remain present');
  if (result.viewMode !== 'korea-focus') throw new Error(`Expected renderer Korea focus mode, found ${result.viewMode}`);
  if (result.stageKoreaMode !== 'map') throw new Error(`Expected same-stage data-korea-mode=map, found ${result.stageKoreaMode}`);
  if (!result.koreaOverlayOpen) throw new Error('Expected Korea overlay to open inside globe stage');
  if (result.selectedRegion !== 'kr-busan-haeundae-stylized') throw new Error(`Expected Haeundae drilldown, found ${result.selectedRegion}`);
  if (!result.mapCanvasPresent) throw new Error('Expected Korea map SVG canvas to render');
  if (result.contextLineCount < 2) throw new Error(`Expected Korea map context lines, found ${result.contextLineCount}`);
  if (result.householdMarkerCount !== 4) throw new Error(`Expected 4 glowing household markers, found ${result.householdMarkerCount}`);
  if (result.selectedHousehold !== 'sister') throw new Error(`Expected sister household, found ${result.selectedHousehold}`);
  if (result.nameGateState !== 'unlocked') throw new Error(`Expected unlocked name gate, found ${result.nameGateState}`);
  if (result.linkCount !== 3) throw new Error(`Expected 3 건희민하찬희네 Band links, found ${result.linkCount}`);
  if (!result.links.every((href) => href.startsWith('https://band.us/'))) throw new Error('Expected band.us placeholder links');
  console.log('PASS layout, exploration, and Korea morph headless smoke', JSON.stringify(result));
} finally {
  await terminate(chrome);
  await terminate(preview);
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}
