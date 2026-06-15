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
        const clickButtonByStrong = async (text) => {
          const button = await waitFor(
            () => [...document.querySelectorAll('button')].find((candidate) => candidate.querySelector('strong')?.textContent?.trim() === text || candidate.textContent?.includes(text)),
            'button ' + text
          );
          button.click();
        };
        const koreaButton = await waitFor(() => document.querySelector('[data-action="korea-family"]'), 'Korea button');
        koreaButton.click();
        await waitFor(() => window.__GLOBE_QA__?.koreaOverlayOpen === true || document.querySelector('.korea-map-host')?.hidden === false, 'Korea overlay');
        await clickButtonByStrong('부산광역시');
        await waitFor(() => window.__GLOBE_QA__?.selectedRegion === 'kr-busan-stylized', 'Busan tier');
        await clickButtonByStrong('해운대구');
        await waitFor(() => window.__GLOBE_QA__?.selectedRegion === 'kr-busan-haeundae-stylized', 'Haeundae tier');
        await clickButtonByStrong('누나네');
        await waitFor(() => window.__GLOBE_QA__?.selectedHousehold === 'sister', 'sister household');
        const input = document.querySelector('.name-gate input');
        input.value = '박건희';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.name-gate').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitFor(() => window.__GLOBE_QA__?.nameGateState === 'unlocked', 'name gate unlock');
        const links = [...document.querySelectorAll('.band-link')].map((link) => link.href);
        return {
          qa: window.__GLOBE_QA__,
          linkCount: links.length,
          links,
          nonKoreaCityCardStillPresent: Boolean(document.querySelector('.city-card')),
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
  if (result.qa.selectedHousehold !== 'sister') throw new Error('Expected sister household selection');
  if (result.qa.nameGateState !== 'unlocked') throw new Error('Expected unlocked name gate');
  if (result.linkCount !== 3) throw new Error(`Expected 3 sister Band links, found ${result.linkCount}`);
  if (!result.links.every((href) => href.startsWith('https://band.us/'))) throw new Error('Expected band.us placeholder links');
  if (!result.nonKoreaCityCardStillPresent) throw new Error('Expected existing city card surface to remain present');
  console.log('PASS Korea family map headless smoke', JSON.stringify(result));
} finally {
  await terminate(chrome);
  await terminate(preview);
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}
