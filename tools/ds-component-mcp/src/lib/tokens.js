import fs from 'fs';
import { cssVarNameFromPath } from '../../../../scripts/lib/token-css-naming.js';

const TOKEN_KEYS = new Set(['value', '$value']);

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function isTokenNode(node) {
  return !!node && typeof node === 'object' && [...TOKEN_KEYS].some((key) => key in node);
}

export function getNodeByPath(obj, tokenPath) {
  const segments = Array.isArray(tokenPath) ? tokenPath : String(tokenPath).split('.');
  let current = obj;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function findReferencePath(tokens, referencePath) {
  const direct = getNodeByPath(tokens, referencePath);
  if (direct) return referencePath;

  const candidates = [
    `core.${referencePath}`,
    `semantic.${referencePath}`,
    `component.${referencePath}`,
    `typography.${referencePath}`,
  ];

  return candidates.find((candidate) => getNodeByPath(tokens, candidate));
}

export function resolveTokenValue(tokens, rawValue, seen = new Set()) {
  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  const match = rawValue.match(/^\{(.+)\}$/);
  if (!match) {
    return rawValue;
  }

  const referencePath = findReferencePath(tokens, match[1]);
  if (!referencePath || seen.has(referencePath)) {
    return rawValue;
  }

  const referencedNode = getNodeByPath(tokens, referencePath);
  if (!referencedNode || !isTokenNode(referencedNode)) {
    return rawValue;
  }

  seen.add(referencePath);
  const nextValue = referencedNode.value ?? referencedNode.$value;
  return resolveTokenValue(tokens, nextValue, seen);
}

export function buildCssVarName(pathSegments) {
  return cssVarNameFromPath(pathSegments.join('.'));
}

export function flattenTokenTree(node, pathSegments = []) {
  const items = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return items;
  }

  if (isTokenNode(node)) {
    items.push({
      tokenPath: pathSegments.join('.'),
      pathSegments,
      value: node.value ?? node.$value,
      type: node.type ?? node.$type ?? null,
      description: node.description ?? null,
    });
    return items;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    items.push(...flattenTokenTree(value, [...pathSegments, key]));
  }

  return items;
}

export function buildTokenEntry(tokens, tokenPath) {
  const node = getNodeByPath(tokens, tokenPath);
  if (!node || !isTokenNode(node)) {
    return null;
  }

  const pathSegments = tokenPath.split('.');
  return {
    tokenPath,
    cssVar: buildCssVarName(pathSegments),
    rawValue: node.value ?? node.$value,
    resolvedValue: resolveTokenValue(tokens, node.value ?? node.$value),
    type: node.type ?? node.$type ?? null,
    description: node.description ?? null,
  };
}

export function buildComponentTokenEntries(tokens, componentName) {
  const subtree = getNodeByPath(tokens, `component.${componentName}`);
  if (!subtree) {
    return [];
  }

  return flattenTokenTree(subtree, ['component', componentName]).map((token) => ({
    tokenPath: token.tokenPath,
    cssVar: buildCssVarName(token.pathSegments),
    rawValue: token.value,
    resolvedValue: resolveTokenValue(tokens, token.value),
    type: token.type,
    description: token.description,
  }));
}

export function buildKnownCssVars(tokens) {
  return flattenTokenTree(tokens)
    .map((token) => buildCssVarName(token.pathSegments))
    .filter(Boolean);
}
