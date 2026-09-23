import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cssVarNameFromPath, normalizeOutputPath } from './lib/token-css-naming.js';
import { normalizeDesignTokens } from './lib/token-normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const tokenPath = path.join(rootDir, 'tokens.json');
const outputPaths = [
  path.join(rootDir, 'build', 'css', 'variables.css'),
  path.join(rootDir, 'src', 'stories', 'variables.css'),
];

const ignoredKeys = new Set(['$metadata', '$themes', 'tokenSetOrder']);
const maxAliasDepth = 16;

function readTokenValue(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
  if (Object.prototype.hasOwnProperty.call(node, 'value')) return node.value;
  if (Object.prototype.hasOwnProperty.call(node, '$value')) return node.$value;
  return undefined;
}

function readTokenType(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return '';
  return String(node.type || node.$type || '').toLowerCase();
}

function getByPath(root, rawPath) {
  if (!rawPath) return undefined;
  return rawPath
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return current[key];
    }, root);
}

function isAlias(value) {
  return typeof value === 'string' && /^\{.+\}$/.test(value.trim());
}

function parseAlias(value) {
  return String(value).trim().replace(/^\{|\}$/g, '');
}

function aliasCandidates(ref) {
  const candidates = [ref];
  if (!ref.startsWith('core.')) candidates.push(`core.${ref}`);
  if (!ref.startsWith('semantic.')) candidates.push(`semantic.${ref}`);
  if (!ref.startsWith('component.')) candidates.push(`component.${ref}`);
  if (!ref.startsWith('typography.')) candidates.push(`typography.${ref}`);
  return [...new Set(candidates)];
}

function formatShadow(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatShadow).join(', ');
  if (!value || typeof value !== 'object') return null;

  const px = (item) => (typeof item === 'number' ? `${item}px` : item || '0');
  const color = typeof value.color === 'string' ? value.color : '#000000';
  return `${px(value.x)} ${px(value.y)} ${px(value.blur)} ${px(value.spread)} ${color}`;
}

function toCssLiteral(value, type) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const items = value.map((item) => toCssLiteral(item, type)).filter(Boolean);
    return items.length ? items.join(', ') : null;
  }
  if (typeof value === 'object') {
    if (type.includes('shadow') || 'blur' in value || 'spread' in value) return formatShadow(value);
    return null;
  }
  return null;
}

function resolveCssValue(tokens, rawValue, type, depth = 0) {
  if (depth > maxAliasDepth) return null;

  if (!isAlias(rawValue)) {
    return toCssLiteral(rawValue, type);
  }

  const ref = parseAlias(rawValue);
  for (const candidate of aliasCandidates(ref)) {
    const found = getByPath(tokens, candidate);
    const nextValue = readTokenValue(found);
    if (nextValue === undefined) continue;

    const foundType = readTokenType(found) || type;
    const literal = toCssLiteral(nextValue, foundType);
    if (literal === null && isAlias(nextValue)) {
      return resolveCssValue(tokens, nextValue, foundType, depth + 1);
    }
    if (literal === null) continue;

    return `var(${cssVarNameFromPath(candidate)})`;
  }

  return null;
}

function findAliasTarget(tokens, rawValue) {
  if (!isAlias(rawValue)) return null;

  const ref = parseAlias(rawValue);
  for (const candidate of aliasCandidates(ref)) {
    const found = getByPath(tokens, candidate);
    if (found && typeof found === 'object' && !Array.isArray(found)) return found;
  }

  return null;
}

function collectTokens(tokens, node, tokenPath = '', acc = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return acc;

  for (const [key, value] of Object.entries(node)) {
    if (ignoredKeys.has(key) || key.startsWith('$')) continue;

    const nextPath = tokenPath ? `${tokenPath}.${key}` : key;
    const rawValue = readTokenValue(value);
    if (rawValue !== undefined) {
      const type = readTokenType(value);
      const cssValue = resolveCssValue(tokens, rawValue, type);
      if (cssValue !== null) {
        acc.push({
          path: normalizeOutputPath(nextPath),
          name: cssVarNameFromPath(nextPath),
          value: cssValue,
        });
      } else {
        const aliasTarget = findAliasTarget(tokens, rawValue);
        if (aliasTarget) collectTokens(tokens, aliasTarget, nextPath, acc);
      }
      continue;
    }

    collectTokens(tokens, value, nextPath, acc);
  }

  return acc;
}

function buildCss(tokens) {
  const collected = collectTokens(tokens, tokens).sort((a, b) => a.path.localeCompare(b.path));
  const names = new Map();

  for (const token of collected) {
    const previous = names.get(token.name);
    if (previous && previous !== token.path) {
      throw new Error(`Duplicate CSS variable ${token.name}: ${previous} and ${token.path}`);
    }
    names.set(token.name, token.path);
  }

  const declarations = collected.map((token) => `  ${token.name}: ${token.value};`);

  return `/* Generated from tokens.json. Do not edit manually. */\n:root {\n${declarations.join('\n')}\n}\n`;
}

const rawTokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const { tokens, warnings } = normalizeDesignTokens(rawTokens, { returnWarnings: true });
for (const warning of warnings) {
  console.warn(`Token normalization: ${warning}`);
}
const css = buildCss(tokens);

for (const outputPath of outputPaths) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, css, 'utf8');
  console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}
