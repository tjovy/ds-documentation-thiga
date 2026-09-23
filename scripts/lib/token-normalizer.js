const CANONICAL_KEYS = new Set(['core', 'semantic', 'typography', 'component']);

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTokenNode(node) {
  return isObject(node) && (
    Object.prototype.hasOwnProperty.call(node, 'value') ||
    Object.prototype.hasOwnProperty.call(node, '$value')
  );
}

function toCamelSegment(segment) {
  return String(segment).replace(/-([a-z0-9])/gi, (_, char) => char.toUpperCase());
}

function normalizeTokenReference(value) {
  if (typeof value !== 'string') return value;
  const match = value.trim().match(/^\{(.+)\}$/);
  if (!match) return value;

  const normalizedPath = match[1]
    .split('.')
    .filter(Boolean)
    .map(toCamelSegment)
    .join('.');

  return `{${normalizedPath}}`;
}

function normalizeTree(node) {
  if (!isObject(node)) return node;

  if (isTokenNode(node)) {
    const normalized = {
      value: normalizeTokenReference(node.value ?? node.$value),
    };

    if (node.type || node.$type) normalized.type = node.type ?? node.$type;
    if (node.description || node.$description) normalized.description = node.description ?? node.$description;

    return normalized;
  }

  const output = {};
  for (const [rawKey, value] of Object.entries(node)) {
    if (rawKey === '$extensions') continue;
    const key = rawKey.startsWith('$') ? rawKey : toCamelSegment(rawKey);
    output[key] = normalizeTree(value);
  }
  return output;
}

function mergeDeep(target, source) {
  if (!isObject(source)) return target;

  for (const [key, value] of Object.entries(source)) {
    if (isObject(value) && isObject(target[key]) && !isTokenNode(value) && !isTokenNode(target[key])) {
      mergeDeep(target[key], value);
    } else {
      target[key] = value;
    }
  }

  return target;
}

function readSet(rawTokens, setPath) {
  if (!isObject(rawTokens)) return null;
  if (rawTokens[setPath]) return rawTokens[setPath];

  const segments = setPath.split('/').filter(Boolean);
  let current = rawTokens;
  for (const segment of segments) {
    if (!isObject(current) || !current[segment]) return null;
    current = current[segment];
  }

  return current;
}

function countLeaves(node, predicate) {
  if (!isObject(node)) return 0;
  if (isTokenNode(node)) return predicate(node) ? 1 : 0;

  return Object.values(node).reduce((count, child) => count + countLeaves(child, predicate), 0);
}

function countTokenLeaves(node) {
  return countLeaves(node, () => true);
}

function isPlaceholderToken(node) {
  const value = node.value ?? node.$value;
  if (value === 'Valeur de chaîne') return true;
  if (value === '#ffffff' || value === '#FFFFFF') return true;
  if (value === 0 && !String(node.type || node.$type || '').toLowerCase().includes('radius')) return true;
  return false;
}

function addWarning(warnings, message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function hasCanonicalShape(rawTokens) {
  return isObject(rawTokens) && [...CANONICAL_KEYS].some((key) => isObject(rawTokens[key]));
}

function normalizeTokensStudioSets(rawTokens, warnings) {
  const normalized = {};

  const primitive = readSet(rawTokens, 'Primitive/Value') || readSet(rawTokens, 'primitive/value');
  const space = readSet(rawTokens, 'Space/Value') || readSet(rawTokens, 'space/value');
  const radius = readSet(rawTokens, 'Radius/Value') || readSet(rawTokens, 'radius/value');
  const typography = readSet(rawTokens, 'Typography/Value') || readSet(rawTokens, 'typography/value');
  const semantic = readSet(rawTokens, 'Semantic/Dark') || readSet(rawTokens, 'semantic/dark');
  const component = readSet(rawTokens, 'Component/Value') ||
    readSet(rawTokens, 'component/value') ||
    readSet(rawTokens, 'component/component');

  if (primitive) mergeDeep(normalized.core ||= {}, normalizeTree(primitive));
  if (space?.space) mergeDeep(normalized.core ||= {}, { space: normalizeTree(space.space) });
  if (radius?.radius) mergeDeep(normalized.core ||= {}, { radius: normalizeTree(radius.radius) });
  if (typography?.font) mergeDeep(normalized.core ||= {}, { font: normalizeTree(typography.font) });
  if (typography?.typography) normalized.typography = normalizeTree(typography.typography);
  if (semantic) normalized.semantic = normalizeTree(semantic);
  if (component) {
    const total = countTokenLeaves(component);
    const placeholders = countLeaves(component, isPlaceholderToken);
    if (total > 0 && placeholders / total > 0.35) {
      addWarning(
        warnings,
        `Le set component contient ${placeholders}/${total} valeurs placeholder. Il est conserve, mais il faut les remplacer par de vrais alias avant generation documentaire.`,
      );
    }
    normalized.component = normalizeTree(component);
  }

  return normalized;
}

export function normalizeDesignTokens(rawTokens, options = {}) {
  const warnings = [];

  if (!isObject(rawTokens)) {
    throw new Error('tokens.json doit contenir un objet JSON.');
  }

  const normalized = {};
  if (rawTokens.$metadata) normalized.$metadata = rawTokens.$metadata;

  if (hasCanonicalShape(rawTokens)) {
    for (const key of CANONICAL_KEYS) {
      if (isObject(rawTokens[key])) normalized[key] = normalizeTree(rawTokens[key]);
    }
  }

  const fromTokensStudioSets = normalizeTokensStudioSets(rawTokens, warnings);
  mergeDeep(normalized, fromTokensStudioSets);

  const unknownSetKeys = Object.keys(rawTokens).filter((key) => (
    !key.startsWith('$') &&
    !CANONICAL_KEYS.has(key) &&
    ![
      'Primitive/Value',
      'primitive/value',
      'Semantic/Dark',
      'semantic/dark',
      'Typography/Value',
      'typography/value',
      'Space/Value',
      'space/value',
      'Radius/Value',
      'radius/value',
      'Component/Value',
      'component/value',
      'component/component',
      'Primitive',
      'primitive',
      'Semantic',
      'semantic',
      'Typography',
      'typography',
      'Space',
      'space',
      'Radius',
      'radius',
      'Component',
      'component',
      'tokenSetOrder',
      '$themes',
    ].includes(key)
  ));

  if (unknownSetKeys.length) {
    addWarning(warnings, `Sets ignores par la normalisation: ${unknownSetKeys.join(', ')}`);
  }

  if (!normalized.core && !normalized.semantic && !normalized.typography && !normalized.component) {
    throw new Error('Aucun groupe de tokens exploitable trouve. Attendus: core/semantic/typography/component ou sets Tokens Studio Primitive/Semantic/Typography/Space/Radius/Component.');
  }

  if (options.returnWarnings) {
    return { tokens: normalized, warnings };
  }

  return normalized;
}
