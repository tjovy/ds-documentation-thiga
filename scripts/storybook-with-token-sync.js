import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const pollInterval = Number(process.env.STORYBOOK_TOKEN_POLL_INTERVAL_MS || 30000);
const port = String(process.env.STORYBOOK_PORT || 6006);
const storybookBin = path.join(rootDir, 'node_modules', '.bin', 'storybook');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const requestedBranch = process.env.STORYBOOK_REVIEW_BRANCH || 'latest';

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

function getPublishedRefs() {
  const output = execFileSync('git', ['ls-remote', '--heads', 'origin', 'refs/heads/main', 'refs/heads/ai/*'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
  const refs = new Map(output.split('\n').filter(Boolean).map((line) => {
    const [sha, ref] = line.trim().split(/\s+/);
    return [ref.replace('refs/heads/', ''), sha];
  }));
  const main = refs.get('main');
  if (!main) throw new Error('Impossible de lire la reference GitHub main.');
  const reviewBranches = [...refs.keys()].filter((name) => name.startsWith('ai/')).sort().reverse();
  const branch = requestedBranch === 'latest' ? reviewBranches[0] || 'main' : requestedBranch;
  const review = refs.get(branch);
  if (!review) throw new Error(`Branche de revue introuvable: ${branch}`);
  return { main, branch, review };
}

async function refreshPublishedContent(refs) {
  console.log(`\n[storybook] Synchronisation GitHub (main ${refs.main.slice(0, 7)}, ${refs.branch} ${refs.review.slice(0, 7)})...`);
  await run(process.execPath, ['scripts/sync-tokens-preview.js', refs.branch]);
  await run(npmBin, ['run', 'build-docs']);
  console.log('[storybook] Tokens, CSS publie et stories actualises.');
}

let publishedRefs = null;
let syncing = false;

async function syncInitialContent() {
  try {
    const refs = getPublishedRefs();
    await refreshPublishedContent(refs);
    publishedRefs = refs;
  } catch (error) {
    console.warn(`[storybook] Synchronisation initiale ignoree: ${error.message}`);
  }
}

async function pollPublishedContent() {
  if (syncing) return;
  try {
    const nextRefs = getPublishedRefs();
    if (JSON.stringify(nextRefs) === JSON.stringify(publishedRefs)) return;
    syncing = true;
    await refreshPublishedContent(nextRefs);
    publishedRefs = nextRefs;
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
