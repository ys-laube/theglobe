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
        const initialRotationX = window.__GLOBE_QA__?.globeRotation?.x;
        const initialRotationY = window.__GLOBE_QA__?.globeRotation?.y;
        await waitFor(
          () => Math.abs((window.__GLOBE_QA__?.globeRotation?.y ?? initialRotationY) - initialRotationY) > 0.006,
          'earth auto rotation'
        );
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
          'The globe is glowing with its final details.',
          'Official static region',
          'official static region',
          '17 first-level regions',
          '17-first-level region',
          '우리 가족이 이어지는 지도',
          '빛나는 길을 따라',
          '가족 이름',
          '예: 한유진',
          '로그인이나 개인정보 저장 없이',
          '초대 링크 열기',
          '이름을 다시 확인해 주세요',
        ].filter((text) => bodyText.includes(text));
        const koreaButtonPresent = Boolean(document.querySelector('[data-action="korea-family"]'));

        const exploreButton = await waitFor(() => document.querySelector('[data-action="explore"]:not(:disabled)'), 'exploration button');
        exploreButton.click();
        await waitFor(() => document.querySelector('[data-visible-count]')?.textContent?.trim() === '193', 'all UN member-state capitals visible');
        const capitalsTitle = document.querySelector('[data-tier-title]')?.textContent?.trim();
        const capitalsCopy = document.querySelector('[data-tier-copy]')?.textContent?.trim();
        const capitalFocusOk = window.__GLOBE_QA_FOCUS_CITY__?.('capital-seoul', 'capitals');
        await waitFor(() => window.__GLOBE_QA__?.selectedCityId === 'capital-seoul', 'capital Seoul rendered card');
        const capitalCardText = document.querySelector('.city-card')?.textContent ?? '';
        const capitalCardTitle = document.querySelector('.city-card h2')?.textContent?.trim();
        const capitalCardDetails = [...document.querySelectorAll('.city-card dd')].map((node) => node.textContent?.trim()).filter(Boolean);
        const approvedFirstScreenCopyPresent = bodyText.includes('where are you? where do you want to go?');
        const top100Toggle = document.querySelector('[data-action="toggle-tier"]');
        const toggleLabelBefore = top100Toggle?.textContent?.trim();
        top100Toggle.click();
        await waitFor(() => document.querySelector('[data-visible-count]')?.textContent?.trim() === '100', 'TOP100 visible');
        const top100Title = document.querySelector('[data-tier-title]')?.textContent?.trim();
        const toggleLabelAfter = top100Toggle?.textContent?.trim();
        const top100Count = document.querySelector('[data-visible-count]')?.textContent?.trim();
        const top100GroupCount = document.querySelectorAll('[data-rank-group]').length;
        const top100ListEntryCount = document.querySelectorAll('[data-rank-group] li[data-city-id]').length;
        const top100RankGroups = [...document.querySelectorAll('[data-rank-group]')].map((group) => group.getAttribute('data-rank-group'));
        const rotationBeforeCityFocus = window.__GLOBE_QA__?.globeRotation ?? { x: initialRotationX, y: initialRotationY, z: 0 };
        const top100HongKongButton = document.querySelector('[data-action="focus-city"][data-city-id="top100-hong-kong"]');
        top100HongKongButton?.click();
        await waitFor(() => window.__GLOBE_QA__?.selectedCityId === 'top100-hong-kong', 'TOP100 Hong Kong selected from list');
        await waitFor(() => window.__GLOBE_QA__?.selectedCityMarkerGlowVisible, 'TOP100 Hong Kong selected marker glow');
        await waitFor(() => window.__GLOBE_QA__?.selectedCityListHighlighted, 'TOP100 Hong Kong selected list highlight');
        await waitFor(() => window.__GLOBE_QA__?.lastFocusRotationDelta > 0.006, 'TOP100 list city focus target delta');
        await waitFor(() => Math.abs((window.__GLOBE_QA__?.globeRotation?.y ?? rotationBeforeCityFocus.y) - rotationBeforeCityFocus.y) > 0.08, 'TOP100 list city focus rotation');
        const focusedCityCardTitle = document.querySelector('.city-card h2')?.textContent?.trim();
        const focusedCityCardKicker = document.querySelector('.city-card .card-kicker')?.textContent?.trim();
        const focusedCityCardOpen = Boolean(document.querySelector('.city-card[data-empty="false"]:not([hidden])'));
        const focusedCityCardLink = document.querySelector('.city-card a[href^="https://"]')?.href;
        const listFocusRotationDeltaY = Math.abs((window.__GLOBE_QA__?.globeRotation?.y ?? rotationBeforeCityFocus.y) - rotationBeforeCityFocus.y);
        const selectedCityFromQa = window.__GLOBE_QA__?.selectedCity;
        const listSelectedGlowVisible = window.__GLOBE_QA__?.selectedCityMarkerGlowVisible;
        const listSelectedHighlighted = window.__GLOBE_QA__?.selectedCityListHighlighted;

        const canvas = document.querySelector('#globe');
        const clickProjectedCity = async (cityId, lat, lng, label) => {
          const button = document.querySelector('[data-action=\"focus-city\"][data-city-id=\"' + cityId + '\"]');
          button?.click();
          await waitFor(() => window.__GLOBE_QA__?.selectedCityId === cityId, label + ' selected from list');
          let point = null;
          await waitFor(() => {
            point = window.__GLOBE_QA_PROJECT_LOCATION__?.(lat, lng) ?? null;
            return point?.visible === true && Number.isFinite(point.clientX) && Number.isFinite(point.clientY);
          }, label + ' projected on visible globe');
          canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: point.clientX, clientY: point.clientY, pointerId: 77, pointerType: 'mouse' }));
          await waitFor(() => window.__GLOBE_QA__?.selectedCityId === cityId && window.__GLOBE_QA__?.viewMode === 'earth', label + ' marker click priority');
          await waitFor(() => window.__GLOBE_QA__?.selectedCityMarkerGlowVisible, label + ' selected marker glow');
          await waitFor(() => window.__GLOBE_QA__?.selectedCityListHighlighted, label + ' selected TOP100 list highlight');
          return document.querySelector('.city-card h2')?.textContent?.trim();
        };
        const seoulMarkerCardTitle = await clickProjectedCity('top100-seoul', 37.5665, 126.978, 'Seoul');
        const seoulMarkerGlowVisible = window.__GLOBE_QA__?.selectedCityMarkerGlowVisible;
        const seoulListHighlighted = window.__GLOBE_QA__?.selectedCityListHighlighted;
        const jejuMarkerCardTitle = await clickProjectedCity('top100-jeju', 33.4996, 126.5312, 'Jeju');
        const jejuMarkerGlowVisible = window.__GLOBE_QA__?.selectedCityMarkerGlowVisible;
        const jejuListHighlighted = window.__GLOBE_QA__?.selectedCityListHighlighted;

        window.dispatchEvent(new CustomEvent('korea-family-map-request'));
        await waitFor(() => window.__GLOBE_QA__?.viewMode === 'korea-focus', 'Korea focus view mode');
        await waitFor(() => window.__GLOBE_QA__?.koreaOverlayOpen === true || document.querySelector('.korea-map-host')?.hidden === false, 'same-stage Korea map');
        const officialFirstLevelLabels = ['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'];
        const renderedFirstLevelCount = officialFirstLevelLabels.filter((label) => document.body.textContent?.includes(label)).length;
        const busanChoice = document.querySelector('.route-choice[data-region-id="kr-busan"]');
        const busanRegion = document.querySelector('.korea-region[data-region-id="kr-busan"]');
        busanChoice?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        await waitFor(() => busanRegion?.classList.contains('is-highlighted'), 'Busan list hover highlights map');
        const listHoverHighlightsMap = busanRegion?.classList.contains('is-highlighted');
        busanChoice?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
        busanRegion?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        await waitFor(() => busanChoice?.classList.contains('is-highlighted'), 'Busan map hover highlights list');
        const mapHoverHighlightsList = busanChoice?.classList.contains('is-highlighted');
        busanRegion?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
        const koreaRegionCount = document.querySelectorAll('.korea-region').length;
        const koreaRegionLabels = [...document.querySelectorAll('.korea-region')].map((node) => node.getAttribute('aria-label') || node.textContent?.trim() || '').filter(Boolean);
        const householdMarkerCount = document.querySelectorAll('.household-marker').length;
        const householdMarkerLabels = [...document.querySelectorAll('.household-marker-label')].map((node) => node.textContent?.trim()).filter(Boolean);
        const islandReferenceCount = document.querySelectorAll('.korea-island-reference').length;
        const islandReferenceLabels = [...document.querySelectorAll('.korea-island-label')].map((node) => node.textContent?.trim()).filter(Boolean);
        const satelliteStyleCopyPresent = /satellite-style|위성풍/.test(document.body.textContent ?? '');
        const openRoot = async () => {
          await clickButtonByStrong('대한민국');
          await waitFor(() => window.__GLOBE_QA__?.selectedRegion === 'kr-korea-overview', 'Korea overview tier');
        };
        const unlockFamilyPath = async ({ labels, terminalRegion, householdLabel, householdId, acceptedName }) => {
          for (const label of labels) await clickButtonByStrong(label);
          await waitFor(() => window.__GLOBE_QA__?.selectedRegion === terminalRegion, terminalRegion + ' tier');
          const routeChoiceLabels = [...document.querySelectorAll('.route-choice strong, .household-card strong')].map((node) => node.textContent?.trim()).filter(Boolean);
          await clickButtonByStrong(householdLabel);
          await waitFor(() => window.__GLOBE_QA__?.selectedHousehold === householdId, householdLabel + ' household');
          const input = document.querySelector('.name-gate input');
          const gateBeforeUnlockCopy = document.querySelector('.name-gate')?.textContent ?? '';
          const linksBeforeUnlock = document.querySelectorAll('.band-link').length;
          input.value = '틀린 암구호';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('.name-gate').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await waitFor(() => window.__GLOBE_QA__?.nameGateState === 'invalid', householdLabel + ' invalid passphrase');
          const invalidFeedback = document.querySelector('.name-gate-feedback')?.textContent?.trim();
          const acceptedInput = document.querySelector('.name-gate input');
          acceptedInput.value = acceptedName;
          acceptedInput.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('.name-gate').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          await waitFor(() => window.__GLOBE_QA__?.nameGateState === 'unlocked', householdLabel + ' name gate unlock');
          const links = [...document.querySelectorAll('.band-link')].map((link) => link.href);
          return {
            gateBeforeUnlockCopy,
            linksBeforeUnlock,
            invalidFeedback,
            householdId,
            householdLabel,
            terminalRegion: window.__GLOBE_QA__?.selectedRegion,
            selectedHousehold: window.__GLOBE_QA__?.selectedHousehold,
            nameGateState: window.__GLOBE_QA__?.nameGateState,
            routeChoiceLabels,
            linkCount: links.length,
            links,
          };
        };
        const seoulFamilyPath = await unlockFamilyPath({ labels: ['서울특별시', '마포구'], terminalRegion: 'kr-seoul-mapo', householdLabel: '진주네', householdId: 'brother', acceptedName: '한진주' });
        await openRoot();
        const gyeongnamFamilyPath = await unlockFamilyPath({ labels: ['경상남도', '김해시', '봉황동'], terminalRegion: 'kr-gimhae-bonghwang', householdLabel: '은하네', householdId: 'home', acceptedName: '한은하' });
        await openRoot();
        const busanParentsPath = await unlockFamilyPath({ labels: ['부산광역시', '해운대구'], terminalRegion: 'kr-busan-haeundae', householdLabel: '한가네 본가', householdId: 'parents', acceptedName: '한봉수' });
        await openRoot();
        const busanSisterPath = await unlockFamilyPath({ labels: ['부산광역시', '해운대구'], terminalRegion: 'kr-busan-haeundae', householdLabel: '건희민하찬희네', householdId: 'sister', acceptedName: '박건희' });
        const routeChoiceLabels = busanSisterPath.routeChoiceLabels;
        const links = busanSisterPath.links;

        return {
          qa: window.__GLOBE_QA__,
          rejectedCopy,
          approvedFirstScreenCopyPresent,
          koreaButtonPresent,
          capitalsTitle,
          capitalsCopy,
          capitalFocusOk,
          capitalCardTitle,
          capitalCardDetails,
          capitalCardText,
          toggleLabelBefore,
          top100Title,
          toggleLabelAfter,
          count: top100Count,
          top100GroupCount,
          top100ListEntryCount,
          top100RankGroups,
          focusedCityCardTitle,
          focusedCityCardKicker,
          focusedCityCardOpen,
          focusedCityCardLink,
          listFocusRotationDeltaY,
          selectedCityFromQa,
          listSelectedGlowVisible,
          listSelectedHighlighted,
          seoulMarkerCardTitle,
          seoulMarkerGlowVisible,
          seoulListHighlighted,
          jejuMarkerCardTitle,
          jejuMarkerGlowVisible,
          jejuListHighlighted,
          panelHasStatsLanguage: /regions|visible capitals|Premium highlights/.test(bodyText),
          cityCardPresent: Boolean(document.querySelector('.city-card')),
          stageKoreaMode: document.querySelector('.globe-stage')?.getAttribute('data-korea-mode'),
          koreaOverlayOpen: window.__GLOBE_QA__?.koreaOverlayOpen,
          viewMode: window.__GLOBE_QA__?.viewMode,
          selectedRegion: window.__GLOBE_QA__?.selectedRegion,
          rotationDeltaY: Math.abs((window.__GLOBE_QA__?.globeRotation?.y ?? initialRotationY) - initialRotationY),
          weatherCopyPresent: /weather|날씨|Open-Meteo|simulated weather/i.test(bodyText),
          weatherCardPresent: Boolean(document.querySelector('[data-weather-card], .weather-card, .weather-layer')),
          mapCanvasPresent: Boolean(document.querySelector('.korea-map-canvas svg')),
          koreaRegionCount,
          koreaRegionLabels,
          contextLineCount: document.querySelectorAll('.korea-context-line').length,
          renderedFirstLevelCount,
          listHoverHighlightsMap,
          mapHoverHighlightsList,
          householdMarkerCount,
          householdMarkerLabels,
          islandReferenceCount,
          islandReferenceLabels,
          satelliteStyleCopyPresent,
          routeChoiceLabels,
          seoulFamilyPath,
          gyeongnamFamilyPath,
          busanParentsPath,
          busanSisterPath,
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
  if (!result.approvedFirstScreenCopyPresent) throw new Error('Expected approved first-screen copy to be rendered');
  if (result.capitalsTitle !== '세계의 수도') throw new Error(`Expected capitals title, found ${result.capitalsTitle}`);
  if (result.capitalsCopy !== '전 세계 UN가입국의 수도를 보여줍니다') throw new Error(`Expected UN member-state capitals copy, found ${result.capitalsCopy}`);
  if (!result.capitalFocusOk || result.capitalCardTitle !== 'Seoul') throw new Error(`Expected rendered capital Seoul card, found ${result.capitalCardTitle}`);
  if (!result.capitalCardDetails?.includes('Gyeongbokgung Palace') || !result.capitalCardDetails?.includes('kimchi jjigae')) throw new Error(`Expected rendered capital card Landmark/Food, found ${result.capitalCardDetails?.join(', ')}`);
  if (/landmarks?|highlights?|popular travel dining|local food culture|\$\{?city\}?/i.test(result.capitalCardText ?? '')) throw new Error(`Capital card contains placeholder content: ${result.capitalCardText}`);
  if (result.toggleLabelBefore !== 'TOP 100 인기 도시 보기') throw new Error(`Expected TOP100 toggle label, found ${result.toggleLabelBefore}`);
  if (result.top100Title !== 'TOP 100 인기 도시') throw new Error(`Expected TOP100 title, found ${result.top100Title}`);
  if (result.toggleLabelAfter !== '수도 보기') throw new Error(`Expected return-to-capitals toggle label, found ${result.toggleLabelAfter}`);
  if (result.count !== '100') throw new Error(`Expected 100 TOP100 cities, found ${result.count}`);
  if (result.top100GroupCount !== 10) throw new Error(`Expected 10 TOP100 rank groups, found ${result.top100GroupCount}`);
  if (result.top100ListEntryCount !== 100) throw new Error(`Expected 100 TOP100 list entries, found ${result.top100ListEntryCount}`);
  const expectedRankGroups = ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'];
  if (JSON.stringify(result.top100RankGroups) !== JSON.stringify(expectedRankGroups)) throw new Error(`Expected TOP100 rank groups ${expectedRankGroups.join(', ')}, found ${result.top100RankGroups?.join(', ')}`);
  if (result.selectedCityFromQa?.id !== 'top100-hong-kong' || result.selectedCityFromQa?.rank !== 1) throw new Error(`Expected QA selected TOP100 Hong Kong rank 1, found ${JSON.stringify(result.selectedCityFromQa)}`);
  if (!result.listSelectedGlowVisible) throw new Error('Expected TOP100 list selection to show selected city marker glow');
  if (!result.listSelectedHighlighted) throw new Error('Expected TOP100 list selection to highlight selected list row');
  if (result.listFocusRotationDeltaY <= 0.08) throw new Error(`Expected list click to rotate/focus globe, delta=${result.listFocusRotationDeltaY}`);
  if (!result.focusedCityCardOpen) throw new Error('Expected existing detail card to be open after TOP100 list click');
  if (result.focusedCityCardTitle !== '1. Hong Kong') throw new Error(`Expected existing detail card to open Hong Kong, found ${result.focusedCityCardTitle}`);
  if (!result.focusedCityCardKicker?.includes('#1')) throw new Error(`Expected card kicker to include TOP100 rank, found ${result.focusedCityCardKicker}`);
  if (!result.focusedCityCardLink?.startsWith('https://')) throw new Error(`Expected focused card HTTPS link, found ${result.focusedCityCardLink}`);
  if (result.seoulMarkerCardTitle !== '24. Seoul') throw new Error(`Expected Seoul marker click to keep TOP100 city priority, found ${result.seoulMarkerCardTitle}`);
  if (!result.seoulMarkerGlowVisible || !result.seoulListHighlighted) throw new Error('Expected Seoul marker selection to keep glow and TOP100 list highlight');
  if (result.jejuMarkerCardTitle !== '87. Jeju') throw new Error(`Expected Jeju marker click to keep TOP100 city priority, found ${result.jejuMarkerCardTitle}`);
  if (!result.jejuMarkerGlowVisible || !result.jejuListHighlighted) throw new Error('Expected Jeju marker selection to keep glow and TOP100 list highlight');
  if (result.panelHasStatsLanguage) throw new Error('Expected old stats/premium panel language to be removed');
  if (!result.cityCardPresent) throw new Error('Expected existing city card surface to remain present');
  if (result.rotationDeltaY <= 0.006) throw new Error(`Expected globe auto-rotation, delta=${result.rotationDeltaY}`);
  if (result.weatherCopyPresent || result.weatherCardPresent) throw new Error('Expected weather UI/copy to be removed');
  if (result.viewMode !== 'korea-focus') throw new Error(`Expected renderer Korea focus mode, found ${result.viewMode}`);
  if (result.stageKoreaMode !== 'map') throw new Error(`Expected same-stage data-korea-mode=map, found ${result.stageKoreaMode}`);
  if (!result.koreaOverlayOpen) throw new Error('Expected Korea overlay to open inside globe stage');
  if (result.selectedRegion !== 'kr-busan-haeundae') throw new Error(`Expected Haeundae drilldown, found ${result.selectedRegion}`);
  if (result.renderedFirstLevelCount !== 17) throw new Error(`Expected 17 first-level Korea labels, found ${result.renderedFirstLevelCount}`);
  if (result.koreaRegionCount !== 21) throw new Error(`Expected 21 Korea region polygons (17 first-level + 4 family drilldowns), found ${result.koreaRegionCount}`);
  if (!result.listHoverHighlightsMap || !result.mapHoverHighlightsList) throw new Error('Expected Korea list/map cross-highlight in both directions');
  if (!result.mapCanvasPresent) throw new Error('Expected Korea map SVG canvas to render');
  if (result.koreaRegionCount < 21) throw new Error(`Expected Korea boundary layer to render at least 21 regions (17 first-level plus family targets), found ${result.koreaRegionCount}`);
  for (const requiredRegionLabel of ['서울특별시', '부산광역시', '해운대구', '마포구', '경상남도', '김해시', '봉황동']) {
    if (!result.koreaRegionLabels?.some((label) => label.includes(requiredRegionLabel))) throw new Error(`Expected Korea boundary aria label for ${requiredRegionLabel}, found ${result.koreaRegionLabels?.join(', ')}`);
  }
  if (result.contextLineCount < 2) throw new Error(`Expected Korea map context lines, found ${result.contextLineCount}`);
  if (result.householdMarkerCount !== 4) throw new Error(`Expected 4 glowing household markers, found ${result.householdMarkerCount}`);
  if (result.islandReferenceCount !== 3) throw new Error(`Expected 3 Jeju/Ulleungdo/Dokdo island references, found ${result.islandReferenceCount}`);
  for (const requiredIslandLabel of ['제주도', '울릉도', '독도']) {
    if (!result.islandReferenceLabels?.includes(requiredIslandLabel)) throw new Error(`Expected island reference label ${requiredIslandLabel}, found ${result.islandReferenceLabels?.join(', ')}`);
  }
  if (!result.satelliteStyleCopyPresent) throw new Error('Expected static satellite-style Korea overlay copy');
  for (const requiredHouseholdLabel of ['한가네 본가', '건희민하찬희네', '진주네', '은하네']) {
    if (!result.householdMarkerLabels?.includes(requiredHouseholdLabel)) throw new Error(`Expected household marker label ${requiredHouseholdLabel}, found ${result.householdMarkerLabels?.join(', ')}`);
  }
  const expectedFamilyPaths = [
    { key: 'seoulFamilyPath', terminalRegion: 'kr-seoul-mapo', householdId: 'brother', householdLabel: '진주네', linkCount: 1 },
    { key: 'gyeongnamFamilyPath', terminalRegion: 'kr-gimhae-bonghwang', householdId: 'home', householdLabel: '은하네', linkCount: 1 },
    { key: 'busanParentsPath', terminalRegion: 'kr-busan-haeundae', householdId: 'parents', householdLabel: '한가네 본가', linkCount: 2 },
    { key: 'busanSisterPath', terminalRegion: 'kr-busan-haeundae', householdId: 'sister', householdLabel: '건희민하찬희네', linkCount: 3 },
  ];
  for (const expectedPath of expectedFamilyPaths) {
    const actualPath = result[expectedPath.key];
    if (actualPath?.terminalRegion !== expectedPath.terminalRegion) throw new Error(`Expected ${expectedPath.householdLabel} terminal ${expectedPath.terminalRegion}, found ${actualPath?.terminalRegion}`);
    if (actualPath?.selectedHousehold !== expectedPath.householdId) throw new Error(`Expected ${expectedPath.householdLabel} household ${expectedPath.householdId}, found ${actualPath?.selectedHousehold}`);
    if (actualPath?.nameGateState !== 'unlocked') throw new Error(`Expected ${expectedPath.householdLabel} name gate unlocked, found ${actualPath?.nameGateState}`);
    if (actualPath?.invalidFeedback !== '암구호 틀림') throw new Error(`Expected ${expectedPath.householdLabel} invalid gate copy, found ${actualPath?.invalidFeedback}`);
    if (actualPath?.linksBeforeUnlock !== 0) throw new Error(`Expected ${expectedPath.householdLabel} links hidden before unlock, found ${actualPath?.linksBeforeUnlock}`);
    if (!actualPath?.gateBeforeUnlockCopy?.includes('암구호를 대시오!') || !actualPath?.gateBeforeUnlockCopy?.includes('암구호 확인')) throw new Error(`Expected ${expectedPath.householdLabel} passphrase gate copy, found ${actualPath?.gateBeforeUnlockCopy}`);
    if (actualPath?.linkCount !== expectedPath.linkCount) throw new Error(`Expected ${expectedPath.householdLabel} ${expectedPath.linkCount} Band placeholder links, found ${actualPath?.linkCount}`);
    if (!actualPath?.links?.every((href) => href.startsWith('https://band.us/band/') && href.includes('-placeholder-'))) throw new Error(`Expected placeholder-only band.us links for ${expectedPath.householdLabel}, found ${actualPath?.links?.join(', ')}`);
  }
  if (result.selectedHousehold !== 'sister') throw new Error(`Expected sister household, found ${result.selectedHousehold}`);
  if (result.nameGateState !== 'unlocked') throw new Error(`Expected unlocked name gate, found ${result.nameGateState}`);
  if (result.linkCount !== 3) throw new Error(`Expected 3 건희민하찬희네 Band links, found ${result.linkCount}`);
  if (!result.links.every((href) => href.startsWith('https://band.us/'))) throw new Error('Expected band.us placeholder links');
  console.log('PASS layout, exploration, Korea family paths, and Korea morph headless smoke', JSON.stringify(result));
} finally {
  await terminate(chrome);
  await terminate(preview);
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}
