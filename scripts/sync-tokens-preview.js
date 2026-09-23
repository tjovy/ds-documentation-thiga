/**
 * sync-tokens-preview.js
 *
 * Downloads the latest published tokens.json and generated variables.css
 * from `main`, then downloads tokens-docs.json from a specific AI branch.
 *
 * This follows the single source of truth workflow:
 * - Figma push -> tokens.json on GitHub
 * - GitHub build -> build/css/variables.css
 * - n8n -> branch that updates only tokens-docs.json
 * - Storybook branch review = main tokens.json + main variables.css + branch tokens-docs.json
 *
 * Usage:
 *   node scripts/sync-tokens-preview.js <branch-name>
 *
 * Example:
 *   node scripts/sync-tokens-preview.js ai/tokens-update-20260215
 *
 * If no branch is provided, it lists available review branches with "ai/" prefix
 * so you can pick the right one.
 */

import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const REPO = process.env.STORYBOOK_GITHUB_REPOSITORY || 'tjovy/ds-documentation-thiga';
const RAW_TOKENS_PATH = path.join(rootDir, 'tokens.json');
const DOCS_PATH = path.join(rootDir, 'tokens-docs.json');
const CSS_PATH = path.join(rootDir, 'src', 'stories', 'variables.css');
// ── Helpers ──────────────────────────────────────────

function fetchJson(url) {
  return JSON.parse(execSync(`curl -sf -H "Accept: application/vnd.github+json" "${url}"`, { encoding: 'utf8' }));
}

function resolveRef(branch) {
  const remote = `https://github.com/${REPO}.git`;
  const ref = `refs/heads/${branch}`;
  const output = execFileSync('git', ['ls-remote', '--heads', remote, ref], {
    encoding: 'utf8',
  }).trim();
  const sha = output.split(/\s+/)[0];

  if (!sha) {
    throw new Error(`Impossible de resoudre le SHA pour ${branch}`);
  }

  return sha;
}

function download(filePath, ref, outputPath) {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${filePath}`;
  execFileSync('curl', ['-fsSL', '--retry', '3', '--retry-delay', '1', '-o', outputPath, url], {
    stdio: 'pipe',
  });
}

function listAIBranches() {
  const url = `https://api.github.com/repos/${REPO}/git/matching-refs/heads/ai/`;
  const result = execSync(
    `curl -sf -H "Accept: application/vnd.github+json" "${url}"`,
    { encoding: 'utf8' }
  );
  const refs = JSON.parse(result);
  return refs
    .map((item) => ({
      branch: item.ref.replace('refs/heads/', ''),
    }))
    .sort((a, b) => b.branch.localeCompare(a.branch));
}

// ── Main ─────────────────────────────────────────────

const branch = process.argv[2];

if (!branch) {
  console.log('\nUsage: node scripts/sync-tokens-preview.js <branch-name>\n');
  console.log(`Looking for AI review branches on ${REPO}...\n`);

  try {
    const branches = listAIBranches();
    if (branches.length === 0) {
      console.log('No AI review branches found (branches starting with "ai/").');
      console.log('Make sure n8n has created a review branch before running this script.');
    } else {
      console.log('Available AI review branches:\n');
      for (const item of branches) {
        console.log(`  Branch: ${item.branch}`);
      }
      console.log('Run again with the branch name:');
      console.log(`  node scripts/sync-tokens-preview.js ${branches[0].branch}\n`);
    }
  } catch {
    console.log('Could not fetch AI branches (network error or API rate limit).');
    console.log('You can still run with a known branch name:');
    console.log('  node scripts/sync-tokens-preview.js ai/tokens-update-XXXXXX\n');
  }
  process.exit(0);
}

console.log(`\nSyncing Storybook preview from branch "${branch}"...\n`);

let mainSha;
let branchSha;

try {
  mainSha = resolveRef('main');
  branchSha = resolveRef(branch);
  console.log(`  ℹ️   main -> ${mainSha.slice(0, 7)}`);
  console.log(`  ℹ️   ${branch} -> ${branchSha.slice(0, 7)}`);
} catch (error) {
  console.error(`  ❌  Impossible de resoudre les refs GitHub: ${error.message}`);
  process.exit(1);
}

// Download latest tokens from main
try {
  download('tokens.json', mainSha, RAW_TOKENS_PATH);
  console.log(`  ✅  tokens.json downloaded from "main" (${mainSha.slice(0, 7)})`);
} catch {
  console.error('  ❌  Could not download tokens.json from "main".');
  process.exit(1);
}

// Download tokens-docs.json (AI-enriched descriptions)
try {
  download('tokens-docs.json', branchSha, DOCS_PATH);
  console.log(`  ✅  tokens-docs.json downloaded from "${branch}" (${branchSha.slice(0, 7)})`);
} catch {
  console.warn(`  ⚠️   tokens-docs.json not found on branch "${branch}".`);
  console.warn('        AI descriptions will not be available — falling back to Figma descriptions.');
}

try {
  download('build/css/variables.css', mainSha, CSS_PATH);
  console.log(`  ✅  variables.css downloaded from "main" (${mainSha.slice(0, 7)})`);
} catch {
  console.warn('  ⚠️   variables.css could not be downloaded from GitHub.');
  console.warn('        Check that the token repo build has pushed build/css/variables.css on main.');
}

console.log('\nDone! Storybook will now use:');
console.log('  - tokens.json from main');
console.log('  - variables.css from main');
console.log(`  - tokens-docs.json from ${branch}`);
console.log('\nNow run Storybook to review the AI branch:');
console.log('  npm run storybook-preview\n');
