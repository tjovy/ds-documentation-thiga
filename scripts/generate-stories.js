import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const tokenPath = path.join(rootDir, 'tokens.json');
const tokenDocsPath = path.join(rootDir, 'tokens-docs.json');
const storiesDir = path.join(rootDir, 'src', 'stories');

const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const tokenDocs = fs.existsSync(tokenDocsPath)
  ? JSON.parse(fs.readFileSync(tokenDocsPath, 'utf8'))
  : {};

const ignoredKeys = new Set(['light', 'dark', 'theme', '$themes', '$metadata', 'tokenSetOrder']);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const cap = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);
const js = (value) => JSON.stringify(value, null, 2);

function readTokenValue(node) {
  if (!node || typeof node !== 'object') return node;
  return node.value !== undefined ? node.value : node.$value;
}

function getByPath(root, rawPath) {
  if (!rawPath) return undefined;
  const keys = rawPath.split('.');
  let current = root;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

function aliasCandidates(ref) {
  const candidates = [ref, `core.${ref}`, `semantic.${ref}`, `component.${ref}`, `typography.${ref}`];
  const fontMap = {
    'font.family.': 'core.fontFamily.',
    'font.size.': 'core.fontSize.',
    'font.weight.': 'core.fontWeight.',
    'font.lineHeight.': 'core.lineHeight.',
    'font.letterSpacing.': 'core.letterSpacing.',
  };

  for (const [from, to] of Object.entries(fontMap)) {
    if (ref.startsWith(from)) candidates.unshift(ref.replace(from, to));
  }

  for (const prefix of ['color', 'spacing', 'radius', 'borderWidth', 'opacity', 'shadow']) {
    if (ref.startsWith(`${prefix}.`)) candidates.unshift(`core.${ref}`);
  }

  return [...new Set(candidates)];
}

function resolveRef(value, depth = 0) {
  if (depth > 12) return value;
  if (typeof value !== 'string') return value;
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value;

  for (const candidate of aliasCandidates(match[1])) {
    const found = getByPath(tokens, candidate);
    const next = readTokenValue(found);
    if (next !== undefined) return resolveRef(next, depth + 1);
  }

  return value;
}

function formatShadow(value) {
  const resolved = resolveRef(value);
  if (typeof resolved === 'string') return resolved;
  if (Array.isArray(resolved)) return resolved.map(formatShadow).join(', ');
  if (resolved && typeof resolved === 'object') {
    const px = (item) => (typeof item === 'number' ? `${item}px` : item || '0');
    return `${px(resolved.x)} ${px(resolved.y)} ${px(resolved.blur)} ${px(resolved.spread)} ${resolveRef(resolved.color || '#000000')}`;
  }
  return 'none';
}

function cssValue(value) {
  const resolved = resolveRef(value);
  if (Array.isArray(resolved)) return resolved.map(cssValue).join(', ');
  if (resolved && typeof resolved === 'object') return formatShadow(resolved);
  return resolved;
}

function flattenTokens(node, prefix = '', jsonPath = '') {
  if (!node || typeof node !== 'object') return [];
  const result = [];

  for (const [key, value] of Object.entries(node)) {
    if (ignoredKeys.has(key)) continue;
    const nextName = prefix ? `${prefix}-${key}` : key;
    const nextJsonPath = jsonPath ? `${jsonPath}.${key}` : key;

    if (value && typeof value === 'object' && (value.value !== undefined || value.$value !== undefined)) {
      result.push({
        name: nextName,
        path: nextJsonPath,
        cssName: `--${nextJsonPath.replace(/\./g, '-')}`,
        value: readTokenValue(value),
        resolved: cssValue(readTokenValue(value)),
        description: value.description || value.$description || '',
        type: value.type || value.$type || '',
      });
    } else if (value && typeof value === 'object') {
      result.push(...flattenTokens(value, nextName, nextJsonPath));
    }
  }

  return result;
}

function collectCompositions(node, category, jsonPrefix) {
  if (!node || typeof node !== 'object') return [];

  return Object.entries(node)
    .filter(([key]) => !ignoredKeys.has(key))
    .map(([key, value]) => {
      const props = {};
      for (const [propName, propValue] of Object.entries(value || {})) {
        const raw = readTokenValue(propValue);
        if (raw !== undefined) props[propName] = cssValue(raw);
      }
      return {
        name: key,
        path: `${category}.${key}`,
        jsonPath: `${jsonPrefix}.${key}`,
        props,
        description: value?.description || '',
      };
    });
}

function writeFile(fileName, content) {
  fs.writeFileSync(path.join(storiesDir, fileName), `${content.trim()}\n`);
}

const dsThemeCss = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --surface-2: #fbfbfd;
  --border: #e6e8ee;
  --border-strong: #d8dbe3;
  --text: #0f1222;
  --text-2: #4a5060;
  --text-3: #7a8093;
  --text-4: #9aa0b0;
  --accent: #4f46e5;
  --accent-soft: #eef0ff;
  --accent-ink: #3730a3;
  --success: #15803d;
  --success-soft: #e7f6ec;
  --warn: #b45309;
  --warn-soft: #fef3c7;
  --danger: #b91c1c;
  --danger-soft: #fde8e8;
  --info: #1d4ed8;
  --info-soft: #e6efff;
  --shadow-card: 0 1px 0 rgba(15,18,34,0.04), 0 2px 6px -2px rgba(15,18,34,0.06);
  --shadow-pop: 0 1px 0 rgba(15,18,34,0.04), 0 10px 30px -10px rgba(15,18,34,0.18);
  --radius-card: 14px;
  --radius-sm: 8px;
}

[data-theme="dark"] {
  --bg: #0b0d12;
  --surface: #11141b;
  --surface-2: #0e1117;
  --border: #1d2330;
  --border-strong: #2a3142;
  --text: #eef0f6;
  --text-2: #b8bdcd;
  --text-3: #868c9d;
  --text-4: #5e6478;
  --accent: #818cf8;
  --accent-soft: #1e1f3d;
  --accent-ink: #c7caff;
  --success: #4ade80;
  --success-soft: #0e2a1c;
  --warn: #fbbf24;
  --warn-soft: #2a2010;
  --danger: #f87171;
  --danger-soft: #2a1416;
  --info: #60a5fa;
  --info-soft: #102036;
  --shadow-card: 0 1px 0 rgba(0,0,0,0.4), 0 2px 6px -2px rgba(0,0,0,0.4);
  --shadow-pop: 0 1px 0 rgba(0,0,0,0.4), 0 10px 30px -10px rgba(0,0,0,0.6);
}

.ds-page, .do-shell {
  background: var(--bg);
  color: var(--text);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-height: 100vh;
}

.ds-page {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.ds-header {
  margin-bottom: 24px;
}

.ds-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ds-title {
  color: var(--text);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  margin: 0;
}

.ds-subtitle {
  color: var(--text-3);
  font-size: 15px;
  line-height: 1.6;
  margin: 10px 0 0;
  max-width: 760px;
}

.ds-count {
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
  border-radius: 999px;
  color: var(--accent-ink);
  font: 600 12px/1 Inter, sans-serif;
  padding: 6px 10px;
}

.ds-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.ds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.ds-clickable {
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}

.ds-clickable:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-pop);
  transform: translateY(-1px);
}

.ds-swatch {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  position: relative;
}

.ds-swatch-color {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border-strong) 70%, transparent);
}

.ds-token-name {
  color: var(--text);
  font-weight: 650;
  overflow-wrap: anywhere;
}

.ds-token-value, .ds-code {
  color: var(--text-2);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.ds-description {
  color: var(--text-3);
  font-size: 12.5px;
  line-height: 1.45;
  margin-top: 5px;
}

.ds-copied {
  animation: copiedPop 1.1s ease both;
  background: var(--text);
  border-radius: 999px;
  color: var(--surface);
  font-size: 11px;
  font-weight: 700;
  padding: 5px 8px;
  position: absolute;
  right: 12px;
  top: 12px;
}

@keyframes copiedPop {
  0% { opacity: 0; transform: translateY(4px) scale(0.96); }
  18%, 75% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-4px) scale(0.98); }
}

.ds-scale-list {
  overflow: hidden;
}

.ds-scale-row {
  display: grid;
  grid-template-columns: 190px minmax(120px, 1fr) 90px;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.ds-scale-row:nth-child(even) {
  background: var(--surface-2);
}

.ds-bar-track {
  background: color-mix(in srgb, var(--accent-soft) 55%, transparent);
  border-radius: 999px;
  height: 12px;
  overflow: hidden;
}

.ds-bar-fill {
  background: linear-gradient(90deg, var(--accent), #7c3aed);
  border-radius: inherit;
  height: 100%;
  min-width: 3px;
}

.ds-type-list {
  overflow: hidden;
}

.ds-type-item {
  padding: 24px;
  border-bottom: 1px solid var(--border);
}

.ds-type-item:last-child {
  border-bottom: 0;
}

.ds-type-tag {
  background: var(--accent-soft);
  border-radius: 999px;
  color: var(--accent-ink);
  display: inline-flex;
  font: 700 12px/1 Inter, sans-serif;
  margin-bottom: 14px;
  padding: 6px 10px;
}

.ds-type-sample {
  color: var(--text);
  margin-bottom: 12px;
}

.ds-meta {
  color: var(--text-3);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.ds-meta code {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text-2);
  font-family: "JetBrains Mono", monospace;
  padding: 4px 7px;
}

.ds-radius-grid, .ds-shadow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 16px;
}

.ds-radius-card, .ds-shadow-card, .ds-component-card {
  padding: 18px;
}

.ds-radius-box {
  background: linear-gradient(135deg, var(--accent), #06b6d4);
  height: 80px;
  margin-bottom: 14px;
  width: 80px;
}

.ds-shadow-box {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 12px;
  height: 84px;
  margin-bottom: 14px;
}

.ds-opacity-row {
  display: grid;
  grid-template-columns: 190px minmax(140px, 1fr) 90px;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.ds-opacity-row:nth-child(even) {
  background: var(--surface-2);
}

.ds-checker {
  background-image: linear-gradient(45deg, #d8dbe3 25%, transparent 25%), linear-gradient(-45deg, #d8dbe3 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d8dbe3 75%), linear-gradient(-45deg, transparent 75%, #d8dbe3 75%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  height: 24px;
  overflow: hidden;
}

.ds-opacity-fill {
  background: var(--accent);
  height: 100%;
  width: 100%;
}

.ds-table {
  border-collapse: collapse;
  width: 100%;
}

.ds-table th {
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  color: var(--text-4);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 12px 16px;
  text-align: left;
  text-transform: uppercase;
}

.ds-table td {
  border-bottom: 1px solid var(--border);
  color: var(--text-2);
  font-size: 13px;
  padding: 14px 16px;
  vertical-align: middle;
}

.ds-table tbody tr:hover {
  background: var(--surface-2);
}

.ds-mini-swatch {
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  display: inline-block;
  height: 20px;
  margin-right: 8px;
  vertical-align: middle;
  width: 20px;
}

.ds-preview-band {
  background: #171a22;
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 18px;
}

.ds-button {
  align-items: center;
  border-radius: 8px;
  border: 1px solid transparent;
  display: inline-flex;
  font-weight: 700;
  justify-content: center;
}

.ds-button.sm { min-height: 32px; padding: 4px 10px; font-size: 13px; }
.ds-button.md { min-height: 40px; padding: 8px 16px; font-size: 14px; }
.ds-button.lg { min-height: 48px; padding: 10px 24px; font-size: 16px; }
.ds-button.primary { background: var(--accent); color: white; }
.ds-button.secondary { background: white; border-color: var(--border-strong); color: #111827; }
.ds-button.danger { background: var(--danger); color: white; }

.ds-input-grid, .ds-card-grid, .ds-badge-grid, .ds-alert-grid {
  display: grid;
  gap: 14px;
}

.ds-input {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text);
  display: grid;
  min-width: 220px;
  padding: 8px 12px;
}

.ds-input.focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.ds-input.error { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-soft); }
.ds-input.disabled { opacity: 0.55; }

.ds-badge {
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 9px;
  width: fit-content;
}

.ds-badge.success { background: var(--success-soft); color: var(--success); }
.ds-badge.warning { background: var(--warn-soft); color: var(--warn); }
.ds-badge.error { background: var(--danger-soft); color: var(--danger); }
.ds-badge.info { background: var(--info-soft); color: var(--info); }
.ds-badge.neutral { background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); }

.ds-alert {
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  gap: 10px;
  padding: 12px;
}

.ds-alert.success { background: var(--success-soft); color: var(--success); }
.ds-alert.warning { background: var(--warn-soft); color: var(--warn); }
.ds-alert.error { background: var(--danger-soft); color: var(--danger); }
.ds-alert.info { background: var(--info-soft); color: var(--info); }

.do-shell * { box-sizing: border-box; }
.do-shell { background: #f9fafb; color: #101828; }
.do-shell button { font: inherit; cursor: pointer; }
.do-app { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100vh; }
.do-sidebar { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 22px; height: 100vh; padding: 18px 14px; position: sticky; top: 0; }
.do-brand { align-items: center; display: flex; gap: 10px; padding: 4px 6px 8px; }
.do-logo { background: linear-gradient(135deg, var(--accent), #7c3aed); border-radius: 8px; color: white; display: grid; font-size: 13px; font-weight: 800; height: 30px; place-items: center; width: 30px; }
.do-brand-title { font-size: 13.5px; font-weight: 700; line-height: 1.15; }
.do-brand-sub { color: var(--text-3); font-size: 11px; }
.do-section-label { color: var(--text-4); font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; padding: 0 8px 6px; text-transform: uppercase; }
.do-nav { display: flex; flex-direction: column; gap: 1px; }
.do-nav-item { align-items: center; border-radius: 7px; color: var(--text-2); display: flex; gap: 10px; padding: 7px 10px; }
.do-nav-item.active, .do-nav-item:hover { background: var(--accent-soft); color: var(--accent-ink); }
.do-count { color: var(--text-4); font-size: 11px; margin-left: auto; }
.do-footer { border-top: 1px solid var(--border); color: var(--text-4); display: flex; font: 500 11px/1.4 "JetBrains Mono", monospace; justify-content: space-between; margin-top: auto; padding: 10px 8px; }
.do-main { min-width: 0; }
.do-home-header { align-items: center; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; height: 85px; justify-content: space-between; padding: 16px 32px; }
.do-home-title { color: #101828; font-size: 24px; font-weight: 800; line-height: 36px; margin: 0; letter-spacing: 0.07px; }
.do-home-title span { color: #6a7282; }
.do-home-title em { font-style: normal; font-weight: 600; }
.do-home-header p { color: #6a7282; font-size: 12px; line-height: 16px; margin: 0; }
.do-home-tools { align-items: center; display: flex; gap: 16px; }
.do-topbar { align-items: center; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 16px; height: 56px; padding: 0 28px; position: sticky; top: 0; z-index: 5; }
.do-crumbs { align-items: center; color: var(--text-3); display: flex; font-size: 13px; gap: 8px; }
.do-current { color: var(--text); font-weight: 650; }
.do-topbar-right { align-items: center; display: flex; gap: 14px; margin-left: auto; }
.do-avatars { display: flex; }
.do-avatar-wrap { position: relative; }
.do-avatar { border: 2px solid var(--surface); border-radius: 50%; color: white; display: grid; flex: 0 0 auto; font-size: 10px; font-weight: 800; height: 26px; place-items: center; width: 26px; }
.do-avatar-wrap:not(:first-child), .do-avatar-more { margin-left: -8px; }
.do-avatar-more { background: var(--surface-2); color: var(--text-2); }
.do-tooltip { background: var(--text); border-radius: 6px; box-shadow: var(--shadow-pop); color: var(--surface); font-size: 11.5px; left: 50%; opacity: 0; padding: 6px 10px; pointer-events: none; position: absolute; top: calc(100% + 8px); transform: translateX(-50%); transition: opacity 120ms; white-space: nowrap; z-index: 30; }
.do-avatar-wrap:hover .do-tooltip { opacity: 1; }
.do-theme-pill { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; display: inline-flex; padding: 2px; }
.do-theme-pill button, .do-icon-btn { background: transparent; border: 0; color: var(--text-3); display: grid; place-items: center; }
.do-theme-pill button { border-radius: 6px; padding: 4px 8px; }
.do-theme-pill button.on { background: var(--surface); box-shadow: var(--shadow-card); color: var(--text); }
.do-icon-btn { border-radius: 8px; height: 34px; position: relative; width: 34px; }
.do-icon-btn:hover { background: var(--surface-2); color: var(--text); }
.do-dot { background: var(--accent); border: 2px solid var(--surface); border-radius: 50%; height: 7px; position: absolute; right: 8px; top: 7px; width: 7px; }
.do-me { align-items: center; border-radius: 999px; display: flex; gap: 8px; padding: 4px 6px 4px 4px; }
.do-content { display: flex; flex-direction: column; gap: 32px; margin: 0 auto; max-width: 1536px; padding: 32px; width: 100%; }
.do-page-head { align-items: flex-end; display: flex; gap: 16px; }
.do-page-title { font-size: 22px; font-weight: 700; margin: 0; }
.do-page-sub { color: var(--text-3); font-size: 13px; margin-top: 2px; }
.do-page-actions { display: flex; gap: 8px; margin-left: auto; }
.do-btn { align-items: center; background: var(--surface); border: 1px solid #e5e7eb; border-radius: 10px; color: #4a5565; display: inline-flex; font-size: 14px; font-weight: 500; gap: 8px; min-height: 38px; padding: 8px 12px; }
.do-btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
.do-kpi-grid { display: grid; gap: 24px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.do-kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 3px rgba(0,0,0,0.10), 0 2px 2px rgba(0,0,0,0.10); display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; grid-template-rows: 48px 20px; column-gap: 16px; height: 117px; padding: 25px; text-align: left; transition: 140ms ease; }
.do-kpi:hover, .do-kpi.active { border-color: #d1d5db; box-shadow: 0 6px 10px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08); transform: translateY(-1px); }
.do-kpi.priority { background: #fff; border-color: #e5e7eb; }
.do-kpi-top { align-items: center; display: contents; }
.do-kpi-icon { background: #ffedd4; border: 0; border-radius: 10px; color: #4f39f6; display: grid; grid-row: 1; height: 48px; place-items: center; width: 48px; }
.do-kpi-badge { background: var(--accent); border-radius: 999px; color: white; font-size: 10px; font-weight: 800; letter-spacing: 0.03em; padding: 3px 8px; text-transform: uppercase; }
.do-kpi-trend { align-self: start; color: #16a34a; font-size: 16px; font-weight: 800; grid-column: 3; grid-row: 1; }
.do-kpi-trend.down { color: #ca3500; }
.do-kpi-num { align-self: center; color: #101828; font-size: 30px; font-weight: 700; grid-column: 2; grid-row: 1; letter-spacing: 0.4px; line-height: 36px; }
.do-kpi-label { align-self: end; color: #4a5565; font-size: 14px; font-weight: 400; grid-column: 1 / -1; grid-row: 2; line-height: 20px; margin-top: 0; }
.do-kpi-foot, .do-delta { align-items: center; display: flex; gap: 5px; }
.do-kpi-foot { color: var(--text-3); font-size: 11.5px; }
.do-delta { font-weight: 800; }
.do-delta.up { color: var(--success); }
.do-delta.warn { color: var(--warn); }
.do-body-grid { align-items: start; display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr) 320px; }
.do-stack, .do-right-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.do-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 1.5px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.1); overflow: hidden; }
.do-home-card { min-height: 0; }
.do-review-detail { margin-top: -8px; }
.do-review-summary { padding: 24px; }
.do-review-summary .do-card-head { min-height: 0; padding: 0; }
.do-card.muted { background: var(--surface-2); }
.do-card-head { align-items: center; border-bottom: 0; display: flex; flex-wrap: wrap; gap: 12px; min-height: 78px; padding: 24px 24px 16px; }
.do-card-head > div:first-child { flex: 1 1 320px; min-width: 0; }
.do-card-title { align-items: center; color: #101828; display: flex; flex-wrap: wrap; font-size: 20px; font-weight: 600; gap: 8px; letter-spacing: 0; line-height: 28px; margin: 0; overflow-wrap: anywhere; }
.do-card-title-text { flex: 1 1 360px; min-width: 0; overflow-wrap: anywhere; }
.do-title-count { background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; color: var(--text-3); flex: none; font-size: 11.5px; font-weight: 600; padding: 2px 7px; white-space: nowrap; }
.do-card-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.do-home-searchbar { border-bottom: 1px solid #e5e7eb; padding: 0 24px 24px; }
.do-search { align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; color: #6a7282; display: flex; gap: 8px; min-height: 38px; padding: 8px 12px; width: 100%; }
.do-search input { background: transparent; border: 0; color: #101828; flex: 1; font: inherit; font-size: 14px; outline: 0; padding: 0; }
.do-search input::placeholder { color: rgba(10,10,10,0.5); }
.do-filter-bar { align-items: center; border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 18px; }
.do-chip { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; color: var(--text-2); font-size: 11.5px; padding: 4px 9px; }
.do-chip.active { background: var(--text); border-color: var(--text); color: var(--surface); }
.do-filter-clear { background: transparent; border: 0; color: var(--text-3); margin-left: auto; }
.do-table { border-collapse: collapse; width: 100%; }
.do-table th { background: #f9fafb; border-bottom: 1px solid #e5e7eb; color: #6a7282; font-size: 12px; font-weight: 500; letter-spacing: 0.6px; line-height: 16px; padding: 12px 24px; text-align: left; text-transform: uppercase; }
.do-table td { border-bottom: 1px solid #e5e7eb; color: #4a5565; font-size: 14px; height: 66px; line-height: 20px; padding: 16px 24px; vertical-align: middle; }
.do-table tbody tr:hover { background: #fbfbfd; }
.do-table tbody tr.selected { background: #f7f8ff; }
.do-table .empty, .empty { color: var(--text-3); font-size: 13px; padding: 34px 18px; text-align: center; }
.do-review-name { color: #4f39f6; display: flex; flex-direction: column; font-weight: 500; gap: 2px; }
.do-review-id { color: var(--text-4); font: 500 10.5px/1 "JetBrains Mono", monospace; }
.do-author { align-items: center; display: flex; gap: 8px; }
.do-elts { display: flex; flex-wrap: wrap; gap: 4px; }
.do-elt { border-radius: 4px; font-size: 12px; font-weight: 500; line-height: 16px; padding: 4px 8px; }
.do-elt.c { background: #f1efff; color: #432dd7; }
.do-elt.k { background: #faf0ff; color: #8200db; }
.do-elt.s { background: #fff0f7; color: #c6005c; }
.do-badge { align-items: center; border-radius: 4px; display: inline-flex; font-size: 12px; font-weight: 500; gap: 4px; line-height: 16px; padding: 4px 8px; }
.do-badge::before { display: none; }
.do-badge.todo { background: #e3e9fc; color: #1447e6; }
.do-badge.progress { background: #f9e7e1; color: #ca3500; }
.do-badge.blocked { background: #ffe4e6; color: #c10007; }
.do-badge.success { background: #dcfce7; color: #008236; }
.do-badge.tosend { background: #f0e1f0; color: purple; }
.do-badge.neutral { background: #fff4e1; border: 0; color: orange; }
.do-row-action { background: #4f39f6; border: 1px solid #4f39f6; border-radius: 10px; color: #fff; font-size: 14px; font-weight: 500; min-height: 32px; padding: 6px 11px; }
.do-row-action.primary { background: #4f39f6; color: #fff; }
.do-pager, .do-see-all { align-items: center; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #4a5565; display: flex; font-size: 14px; justify-content: space-between; line-height: 20px; padding: 17px 24px; }
.do-pages { display: flex; gap: 4px; }
.do-page { background: transparent; border: 0; border-radius: 4px; color: #4a5565; font-size: 16px; min-height: 32px; padding: 4px 12px; width: auto; opacity: 0.5; }
.do-page.active { background: var(--text); color: var(--surface); }
.do-trend { padding: 16px 18px; }
.do-trend-head { align-items: flex-end; display: flex; justify-content: space-between; margin-bottom: 14px; }
.do-trend-label { color: var(--text-3); font-size: 12.5px; font-weight: 650; margin-bottom: 4px; }
.do-trend-num { font-size: 24px; font-weight: 750; line-height: 1; }
.do-spark { height: 64px; width: 100%; }
.do-spark-days { color: var(--text-4); display: flex; font: 500 10px/1 "JetBrains Mono", monospace; justify-content: space-between; margin-top: 6px; }
.do-qa { padding: 14px 16px; }
.do-qa-grid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
.do-qa-item { align-items: center; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; color: var(--text); display: flex; gap: 10px; padding: 10px; text-align: left; }
.do-qa-icon { background: var(--surface); border: 1px solid var(--border); border-radius: 7px; color: var(--accent); display: grid; height: 28px; place-items: center; width: 28px; }
.do-qa-label { font-size: 12.5px; font-weight: 750; }
.do-qa-sub { color: var(--text-3); font-size: 10.5px; }
.do-mention { border-bottom: 1px solid var(--border); display: flex; gap: 10px; padding: 12px 16px; }
.do-mention.unread { background: linear-gradient(90deg, var(--accent-soft), transparent 36%); }
.do-mention-body { color: var(--text-2); flex: 1; font-size: 12.5px; min-width: 0; }
.do-mention-body b, .do-ref { color: var(--text); font-weight: 750; }
.do-ref { color: var(--accent); }
.do-mention-meta { align-items: center; color: var(--text-4); display: flex; font-size: 11px; gap: 8px; margin-top: 4px; }
.do-mention-tag { background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; color: var(--text-3); font-size: 10.5px; padding: 1px 6px; }

@media (max-width: 1100px) {
  .do-app { grid-template-columns: 1fr; }
  .do-sidebar { display: none; }
  .do-kpi-grid, .do-body-grid { grid-template-columns: 1fr; }
  .do-topbar, .do-content { padding-left: 18px; padding-right: 18px; }
  .do-review-summary .do-card-head { align-items: flex-start; flex-direction: column; }
  .do-review-summary .do-card-actions { margin-left: 0; width: 100%; }
}
`;

function generateColorStories() {
  const palettes = ['brand', 'neutral', 'feedback', 'overlay'].filter((palette) => tokens.core?.[palette]);
  const colorsByPalette = Object.fromEntries(
    palettes.map((palette) => [palette, flattenTokens(tokens.core?.[palette] || {}, '', `core.${palette}`)])
  );
  const tokenCount = Object.values(colorsByPalette).reduce((sum, list) => sum + list.length, 0);

  let file = `import React, { useState } from 'react';\nimport './ds-theme.css';\n\nconst PALETTES = ${js(colorsByPalette)};\n\nfunction copyToken(name, setCopied) {\n  navigator.clipboard?.writeText(name);\n  setCopied(name);\n  window.setTimeout(() => setCopied(null), 1000);\n}\n\nfunction ColorPage({ title, tokens }) {\n  const [copied, setCopied] = useState(null);\n  return (\n    <div className="ds-page">\n      <header className="ds-header">\n        <div className="ds-header-row"><h1 className="ds-title">{title} Palette</h1><span className="ds-count">{tokens.length} tokens</span></div>\n        <p className="ds-subtitle">Swatches cliquables pour copier le nom de variable CSS, avec valeur hex et usage documenté.</p>\n      </header>\n      <div className="ds-grid">\n        {tokens.map((token) => (\n          <button key={token.path} className="ds-card ds-swatch ds-clickable" onClick={() => copyToken(token.cssName, setCopied)} type="button">\n            <span className="ds-swatch-color" style={{ background: token.resolved }} />\n            <span>\n              <span className="ds-token-name">{token.name}</span><br />\n              <span className="ds-token-value">{token.resolved}</span>\n              {token.description && <span className="ds-description">{token.description}</span>}\n            </span>\n            {copied === token.cssName && <span className="ds-copied">Copied!</span>}\n          </button>\n        ))}\n      </div>\n    </div>\n  );\n}\n\nexport default { title: 'Design System/Colors' };\n`;

  for (const palette of palettes) {
    file += `\nexport const ${cap(palette)} = () => <ColorPage title="${cap(palette)}" tokens={PALETTES.${palette}} />;\n`;
  }

  writeFile('Colors.stories.jsx', file);
  return `Colors.stories.jsx (${palettes.length} palettes, ${tokenCount} tokens)`;
}

function generateSpacingStories() {
  const data = flattenTokens(tokens.core?.space || tokens.core?.spacing || {}, '', tokens.core?.space ? 'core.space' : 'core.spacing');
  const max = Math.max(...data.map((item) => parseFloat(item.resolved) || 0), 1);
  const rows = data.map((item) => ({ ...item, width: `${Math.max(2, ((parseFloat(item.resolved) || 0) / max) * 100)}%` }));

  const file = `import React from 'react';\nimport './ds-theme.css';\n\nconst SPACING = ${js(rows)};\n\nexport default { title: 'Design System/Spacing' };\n\nexport const Scale = () => (\n  <div className="ds-page">\n    <header className="ds-header">\n      <div className="ds-header-row"><h1 className="ds-title">Spacing Scale</h1><span className="ds-count">{SPACING.length} tokens</span></div>\n      <p className="ds-subtitle">Échelle proportionnelle des espacements, lisible par token et par valeur px.</p>\n    </header>\n    <div className="ds-card ds-scale-list">\n      {SPACING.map((item) => (\n        <div className="ds-scale-row" key={item.path}>\n          <span className="ds-token-name">{item.name}</span>\n          <span className="ds-bar-track"><span className="ds-bar-fill" style={{ width: item.width }} /></span>\n          <span className="ds-token-value">{item.resolved}</span>\n        </div>\n      ))}\n    </div>\n  </div>\n);\n`;

  writeFile('Spacing.stories.jsx', file);
  return `Spacing.stories.jsx (${data.length} tokens)`;
}

function generateTypographyStories() {
  const tokenScale = (group, propsForItem) => flattenTokens(
    tokens.typography?.[group] || {},
    '',
    `typography.${group}`,
  ).map((item) => ({ ...item, props: propsForItem(item) }));
  const groups = tokens.typography?.heading || tokens.typography?.body || tokens.typography?.label
    ? {
      headings: collectCompositions(tokens.typography?.heading, 'heading', 'typography.heading'),
      body: collectCompositions(tokens.typography?.body, 'body', 'typography.body'),
      labels: collectCompositions(tokens.typography?.label, 'label', 'typography.label'),
    }
    : {
      headings: [
        ...tokenScale('family', (item) => ({ fontFamily: item.resolved, fontSize: '32px', lineHeight: '40px' })),
        ...tokenScale('style', (item) => ({ fontWeight: item.resolved, fontSize: '24px', lineHeight: '32px' })),
      ],
      body: [
        ...tokenScale('size', (item) => ({ fontSize: item.resolved })),
        ...tokenScale('lineHeight', (item) => ({ lineHeight: item.resolved })),
      ],
      labels: tokenScale('letterSpacing', (item) => ({ letterSpacing: item.resolved, fontSize: '16px' })),
    };

  const file = `import React from 'react';\nimport './ds-theme.css';\n\nconst TYPOGRAPHY = ${js(groups)};\n\nfunction TypePage({ title, items }) {\n  return (\n    <div className="ds-page">\n      <header className="ds-header">\n        <div className="ds-header-row"><h1 className="ds-title">{title}</h1><span className="ds-count">{items.length} styles</span></div>\n        <p className="ds-subtitle">Rendu live avec les valeurs typographiques réellement résolues depuis les tokens.</p>\n      </header>\n      <div className="ds-card ds-type-list">\n        {items.map((item) => {\n          const s = item.props;\n          return (\n            <section className="ds-type-item" key={item.path}>\n              <span className="ds-type-tag">{item.path}</span>\n              <div className="ds-type-sample" style={{ fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing }}>\n                The quick brown fox jumps over the lazy dog\n              </div>\n              <div className="ds-meta">\n                <code>size {s.fontSize}</code><code>weight {s.fontWeight}</code><code>line-height {s.lineHeight}</code><code>letter-spacing {s.letterSpacing || '0'}</code>\n              </div>\n            </section>\n          );\n        })}\n      </div>\n    </div>\n  );\n}\n\nexport default { title: 'Design System/Typography' };\nexport const Headings = () => <TypePage title="Headings" items={TYPOGRAPHY.headings} />;\nexport const Body = () => <TypePage title="Body" items={TYPOGRAPHY.body} />;\nexport const Labels = () => <TypePage title="Labels" items={TYPOGRAPHY.labels} />;\n`;

  writeFile('Typography.stories.jsx', file);
  return 'Typography.stories.jsx (3 catégories)';
}

function generateRadiusStories() {
  const data = flattenTokens(tokens.core?.radius || {}, '', 'core.radius');
  const file = `import React from 'react';\nimport './ds-theme.css';\n\nconst RADIUS = ${js(data)};\n\nexport default { title: 'Design System/Radius' };\n\nexport const Scale = () => (\n  <div className="ds-page">\n    <header className="ds-header">\n      <div className="ds-header-row"><h1 className="ds-title">Radius Scale</h1><span className="ds-count">{RADIUS.length} tokens</span></div>\n      <p className="ds-subtitle">Carrés de 80px avec chaque border-radius appliqué visuellement.</p>\n    </header>\n    <div className="ds-radius-grid">\n      {RADIUS.map((item) => (\n        <div className="ds-card ds-radius-card" key={item.path}>\n          <div className="ds-radius-box" style={{ borderRadius: item.resolved }} />\n          <div className="ds-token-name">{item.name}</div>\n          <div className="ds-token-value">{item.resolved}</div>\n        </div>\n      ))}\n    </div>\n  </div>\n);\n`;

  writeFile('Radius.stories.jsx', file);
  return `Radius.stories.jsx (${data.length} tokens)`;
}

function generateShadowStories() {
  const data = flattenTokens(tokens.core?.shadow || {}, '', 'core.shadow').map((item) => ({ ...item, resolved: formatShadow(item.value) }));
  const file = `import React from 'react';\nimport './ds-theme.css';\n\nconst SHADOWS = ${js(data)};\n\nexport default { title: 'Design System/Shadows' };\n\nexport const Scale = () => (\n  <div className="ds-page">\n    <header className="ds-header">\n      <div className="ds-header-row"><h1 className="ds-title">Shadows Scale</h1><span className="ds-count">{SHADOWS.length} tokens</span></div>\n      <p className="ds-subtitle">Rectangles blancs sur fond gris pour comparer les élévations.</p>\n    </header>\n    <div className="ds-shadow-grid">\n      {SHADOWS.map((item) => (\n        <div className="ds-card ds-shadow-card" key={item.path}>\n          <div className="ds-shadow-box" style={{ boxShadow: item.resolved }} />\n          <div className="ds-token-name">{item.name}</div>\n          <div className="ds-token-value">{item.resolved}</div>\n        </div>\n      ))}\n    </div>\n  </div>\n);\n`;

  writeFile('Shadows.stories.jsx', file);
  return `Shadows.stories.jsx (${data.length} tokens)`;
}

function generateOpacityStories() {
  const data = flattenTokens(tokens.core?.opacity || {}, '', 'core.opacity');
  const file = `import React from 'react';\nimport './ds-theme.css';\n\nconst OPACITY = ${js(data)};\n\nexport default { title: 'Design System/Opacity' };\n\nexport const Scale = () => (\n  <div className="ds-page">\n    <header className="ds-header">\n      <div className="ds-header-row"><h1 className="ds-title">Opacity Scale</h1><span className="ds-count">{OPACITY.length} tokens</span></div>\n      <p className="ds-subtitle">Barres sur fond damier pour rendre la transparence immédiatement visible.</p>\n    </header>\n    <div className="ds-card ds-scale-list">\n      {OPACITY.map((item) => (\n        <div className="ds-opacity-row" key={item.path}>\n          <span className="ds-token-name">{item.name}</span>\n          <span className="ds-checker"><span className="ds-opacity-fill" style={{ opacity: item.resolved }} /></span>\n          <span className="ds-token-value">{item.resolved}</span>\n        </div>\n      ))}\n    </div>\n  </div>\n);\n`;

  writeFile('Opacity.stories.jsx', file);
  return `Opacity.stories.jsx (${data.length} tokens)`;
}

function generateSemanticStories() {
  const categories = Object.keys(tokens.semantic || {});
  const semantic = Object.fromEntries(
    categories.map((category) => [category, flattenTokens(tokens.semantic?.[category] || {}, '', `semantic.${category}`)])
  );

  const file = `import React, { useState } from 'react';\nimport './ds-theme.css';\n\nconst SEMANTIC = ${js(semantic)};\n\nfunction copyToken(name, setCopied) {\n  navigator.clipboard?.writeText(name);\n  setCopied(name);\n  window.setTimeout(() => setCopied(null), 1000);\n}\n\nfunction SemanticPage({ title, rows }) {\n  const [copied, setCopied] = useState(null);\n  return (\n    <div className="ds-page">\n      <header className="ds-header">\n        <div className="ds-header-row"><h1 className="ds-title">Semantic {title}</h1><span className="ds-count">{rows.length} tokens</span></div>\n        <p className="ds-subtitle">Références sémantiques résolues vers leurs valeurs core, prêtes à être utilisées en CSS.</p>\n      </header>\n      <div className="ds-card">\n        <table className="ds-table">\n          <thead><tr><th>Token</th><th>Référence</th><th>Valeur résolue</th><th>Description</th></tr></thead>\n          <tbody>\n            {rows.map((row) => (\n              <tr key={row.path}>\n                <td><button className="ds-code ds-clickable" type="button" onClick={() => copyToken(row.cssName, setCopied)}>{row.cssName}</button>{copied === row.cssName && <span className="ds-copied">Copied!</span>}</td>\n                <td><span className="ds-mini-swatch" style={{ background: row.resolved }} /> <code>{String(row.value)}</code></td>\n                <td><code>{row.resolved}</code></td>\n                <td>{row.description || '—'}</td>\n              </tr>\n            ))}\n          </tbody>\n        </table>\n      </div>\n    </div>\n  );\n}\n\nexport default { title: 'Design System/Semantic' };\n${categories.map((category) => `export const ${cap(category)} = () => <SemanticPage title="${cap(category)}" rows={SEMANTIC.${category}} />;`).join('\n')}\n`;

  const count = categories.filter((category) => semantic[category].length > 0).length;
  writeFile('Semantic.stories.jsx', file);
  return `Semantic.stories.jsx (${count} catégories)`;
}

function generateTokenDocsComponentStories() {
  const documentedComponentNames = Object.entries(tokenDocs.component || {})
    .filter(([, entry]) => typeof entry?.description === 'string' && entry.description.trim().length > 0)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const usedExports = new Set();
  const componentExports = documentedComponentNames.map((name, index) => {
    const baseName = name
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => cap(part))
      .join('') || `Component${index + 1}`;
    let exportName = /^\d/.test(baseName) ? `Component${baseName}` : baseName;
    while (usedExports.has(exportName)) exportName = `${exportName}${index + 1}`;
    usedExports.add(exportName);
    return `export const ${exportName} = {\n  name: ${JSON.stringify(name)},\n  render: () => <ComponentPage componentName=${JSON.stringify(name)} />,\n};`;
  });

  const file = `import React from 'react';
import { LiveMarkdownViewer } from '../utils/LiveMarkdownViewer';
import DOCS from '../../tokens-docs.json';
import './variables.css';
import './ds-theme.css';

export default { title: 'Design System/Components' };

const componentEntries = Object.entries(DOCS.component || {})
  .map(([name, entry]) => ({
    name,
    description: typeof entry?.description === 'string' ? entry.description.trim() : '',
    meta: entry?._meta || null,
  }))
  .filter((entry) => entry.description.length > 0);

const formatDate = (value) => {
  if (!value) return 'non genere';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const EmptyState = () => (
  <div className="ds-card" style={{ padding: 24 }}>
    <h2 className="ds-token-name" style={{ margin: 0 }}>Aucun composant documente</h2>
    <p className="ds-subtitle" style={{ marginTop: 8 }}>
      Cette page n'affiche pas de preview inventee. Elle attend le Markdown et le JSX valides dans tokens-docs.json.
    </p>
  </div>
);

const AccessibilityPanel = ({ meta, name }) => {
  const accessibility = meta?.accessibility;
  const spec = accessibility?.spec;
  const audit = accessibility?.audit;
  return (
    <section className="zh-a11y" aria-labelledby={'a11y-heading-' + name}>
      <h3 id={'a11y-heading-' + name}>Accessibilité — revue requise</h3>
      {!spec ? (
        <p>Contrat d’accessibilité non encore généré pour cette revue. Ne pas déduire une conformité du seul aperçu visuel.</p>
      ) : (
        <>
          <p>{spec.target} · Source : {spec.source}. Les contrôles statiques ne remplacent pas les tests clavier et lecteur d’écran.</p>
          {spec.requirements?.length > 0 && <ul>{spec.requirements.map((item) => <li key={item.id}><strong>{item.id}</strong> {item.wcag ? '(WCAG ' + item.wcag + ')' : ''} — {item.text}</li>)}</ul>}
          {audit?.staticChecks?.length > 0 && <div><h4>Contrôles du code de preview</h4><ul>{audit.staticChecks.map((item) => <li key={item.id}>{item.status === 'pass' ? 'Présent' : 'Écart à traiter'} : {item.detail}</li>)}</ul></div>}
          {spec.manualChecks?.length > 0 && <div><h4>À vérifier manuellement</h4><ul>{spec.manualChecks.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {audit?.openQuestions?.length > 0 && <div><h4>Décisions ouvertes</h4><ul>{audit.openQuestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </>
      )}
    </section>
  );
};

const ComponentDoc = ({ entry }) => (
  <article className="zh-component-documentation">
    <header className="zh-component-header">
      <div className="ds-header-row">
        <h2 className="ds-title" style={{ fontSize: 24 }}>{entry.name}</h2>
        <span className="ds-count">{entry.meta?.workflowVersion || 'tokens-docs.json'}</span>
      </div>
      <p className="ds-subtitle">
        Source: tokens-docs.json. Variables CSS: src/stories/variables.css.
        {entry.meta?.generatedAt ? ' Genere le ' + formatDate(entry.meta.generatedAt) + '.' : ''}
      </p>
    </header>
    <AccessibilityPanel meta={entry.meta} name={entry.name} />
    <LiveMarkdownViewer content={entry.description} />
  </article>
);

const ComponentPage = ({ componentName }) => {
  const entry = componentEntries.find((item) => item.name === componentName);
  if (!entry) return <div className="ds-page"><EmptyState /></div>;
  return <div className="ds-page"><ComponentDoc entry={entry} /></div>;
};

export const Overview = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row">
        <h1 className="ds-title">Components</h1>
        <span className="ds-count">{componentEntries.length} composant(s)</span>
      </div>
      <p className="ds-subtitle">
        Rendu strictement alimente par tokens-docs.json. Les couleurs, espacements, rayons et typographies utilises par le JSX viennent des variables CSS importees depuis variables.css.
      </p>
    </header>
    <div style={{ display: 'grid', gap: 20 }}>
      {componentEntries.length > 0
        ? componentEntries.map((entry) => <ComponentDoc key={entry.name} entry={entry} />)
        : <EmptyState />}
    </div>
  </div>
);

${componentExports.join('\n\n')}
`;

  writeFile('Components.stories.jsx', file);
  return `Components.stories.jsx (${documentedComponentNames.length} composant(s) depuis tokens-docs.json)`;
}


ensureDir(storiesDir);

console.log('\n🔨 Génération des stories React depuis tokens.json...\n');
writeFile('ds-theme.css', dsThemeCss);
console.log('  ✓ ds-theme.css');
console.log(`  ✓ ${generateColorStories()}`);
console.log(`  ✓ ${generateSpacingStories()}`);
console.log(`  ✓ ${generateTypographyStories()}`);
console.log(`  ✓ ${generateRadiusStories()}`);
console.log(`  ✓ ${generateShadowStories()}`);
console.log(`  ✓ ${generateOpacityStories()}`);
console.log(`  ✓ ${generateSemanticStories()}`);
console.log(`  ✓ ${generateTokenDocsComponentStories()}`);
console.log('\n✅ Toutes les stories ont été générées dans ./src/stories/');
