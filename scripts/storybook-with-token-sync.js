import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const pollInterval = Number(process.env.STORYBOOK_TOKEN_POLL_INTERVAL_MS || 30000);
const port = String(process.env.STORYBOOK_PORT || 6006);
const storybookBin = path.join(rootDir, 'node_modules', '.bin', 'storybook');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} a echoue (${code ?? 'inconnu'}).`));
    });
  });
}

function getPublishedMainRef() {
  const output = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
  const sha = output.split(/\s+/)[0];
  if (!sha) throw new Error('Impossible de lire la reference GitHub main.');
  return sha;
}

async function refreshPublishedContent(reason) {
  console.log(`\n[storybook] Synchronisation GitHub (${reason})...`);
  await run(process.execPath, ['scripts/sync-tokens-preview.js', 'main']);
  await run(npmBin, ['run', 'build-css']);
  await run(npmBin, ['run', 'build-docs']);
  console.log('[storybook] Tokens et stories actualises.');
}

let publishedRef = null;
let syncing = false;

async function syncInitialContent() {
  try {
    publishedRef = getPublishedMainRef();
    await refreshPublishedContent(`main ${publishedRef.slice(0, 7)}`);
  } catch (error) {
    console.warn(`[storybook] Synchronisation initiale ignoree: ${error.message}`);
  }
}

async function pollPublishedContent() {
  if (syncing) return;
  try {
    const nextRef = getPublishedMainRef();
    if (nextRef === publishedRef) return;
    syncing = true;
    await refreshPublishedContent(`nouveau commit ${nextRef.slice(0, 7)}`);
    publishedRef = nextRef;
  } catch (error) {
    console.warn(`[storybook] Synchronisation GitHub impossible: ${error.message}`);
  } finally {
    syncing = false;
  }
}

await syncInitialContent();

const storybook = spawn(storybookBin, ['dev', '-p', port], {
  cwd: rootDir,
  stdio: 'inherit',
});
const timer = setInterval(pollPublishedContent, Math.max(5000, pollInterval));

function stop(signal) {
  clearInterval(timer);
  storybook.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
storybook.once('exit', (code) => {
  clearInterval(timer);
  process.exitCode = code ?? 0;
});
