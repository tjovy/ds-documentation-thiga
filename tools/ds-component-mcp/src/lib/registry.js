import fs from 'fs';
import path from 'path';
import { buildComponentTokenEntries, buildTokenEntry, flattenTokenTree, getNodeByPath, resolveTokenValue } from './tokens.js';
import { extractDesignBlueprint, findFigmaSpec, findRelatedFigmaSpecs, summarizeDesignSpec } from './figma.js';

const ALLOWED_HTML_TAGS = new Set([
  'a',
  'article',
  'aside',
  'button',
  'div',
  'dialog',
  'fieldset',
  'footer',
  'form',
  'header',
  'input',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'option',
  'section',
  'select',
  'span',
  'textarea',
  'ul',
]);

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeUsageRules(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    do: normalizeStringArray(value.do),
    dont: normalizeStringArray(value.dont),
  };
}

function normalizeRenderRequirements(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    mustInclude: normalizeStringArray(value.mustInclude),
    forbiddenPatterns: normalizeStringArray(value.forbiddenPatterns),
  };
}

function normalizeAccessibilitySpec(value, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const requirements = (Array.isArray(value.requirements) ? value.requirements : []).map((item) => ({
    id: String(item?.id || '').trim(),
    wcag: String(item?.wcag || '').trim(),
    text: String(item?.text || '').trim(),
  })).filter((item) => item.id && item.text);
  const ids = requirements.map((item) => item.id);
  if (ids.length !== new Set(ids).size) throw new Error(`Contrat accessibilite invalide (${source}): identifiants dupliques`);
  return {
    source,
    requirements,
    manualChecks: normalizeStringArray(value.manualChecks),
    reviewRequired: true,
  };
}

function normalizeDevContract(value, source) {
  if (!value || typeof value !== 'object') return null;
  const htmlTag = String(value.htmlTag || '').trim().toLowerCase();
  if (htmlTag && !ALLOWED_HTML_TAGS.has(htmlTag)) {
    throw new Error(`Contrat dev MCP invalide (${source}): htmlTag non autorise "${htmlTag}"`);
  }

  const output = {
    source,
    htmlTag: htmlTag || null,
    role: value.role === null || value.role === undefined ? null : String(value.role).trim(),
    interactive: typeof value.interactive === 'boolean' ? value.interactive : null,
    allowedProps: normalizeStringArray(value.allowedProps),
    slots: normalizeStringArray(value.slots),
    usageRules: normalizeUsageRules(value.usageRules),
    accessibility: normalizeStringArray(value.accessibility),
    accessibilitySpec: normalizeAccessibilitySpec(value.accessibilitySpec, source),
    renderRequirements: normalizeRenderRequirements(value.renderRequirements),
  };

  if (
    !output.htmlTag
    && output.role === null
    && output.interactive === null
    && !output.allowedProps.length
    && !output.slots.length
    && !output.usageRules
    && !output.accessibility.length
    && !output.accessibilitySpec
    && !output.renderRequirements
  ) {
    return null;
  }

  return output;
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFigmaDevContract(figmaSpec) {
  const description = String(figmaSpec?.description || '').trim();
  if (!description) return null;

  const markerMatch = description.match(/@thiga-dev\s*([\s\S]+)/i);
  if (!markerMatch) return null;

  const source = markerMatch[1].trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || source;
  const firstObject = candidate.match(/\{[\s\S]*\}/);
  const parsed = parseJsonObject(firstObject?.[0] || candidate);
  return normalizeDevContract(parsed, 'figma-description:@thiga-dev');
}

function extractTokenDevContract(tokens, componentName) {
  const subtree = getNodeByPath(tokens, `component.${componentName}`);
  const raw = subtree?.$dev || subtree?.devContract || null;
  return normalizeDevContract(raw, `tokens:component.${componentName}.$dev`);
}

function applyDevContract(definition, devContract) {
  if (!devContract) return definition;

  const next = {
    ...definition,
    devContractSource: devContract.source,
  };

  if (devContract.htmlTag) {
    next.htmlTag = devContract.htmlTag;
    next.semanticHtmlKnown = true;
  }
  if (devContract.role !== null) next.role = devContract.role || null;
  if (devContract.interactive !== null) next.interactive = devContract.interactive;
  if (devContract.allowedProps.length) next.allowedProps = devContract.allowedProps;
  if (devContract.slots.length) next.slots = devContract.slots;
  if (devContract.usageRules) next.usageRules = devContract.usageRules;
  if (devContract.accessibility.length) next.accessibility = devContract.accessibility;
  if (devContract.accessibilitySpec) next.accessibilitySpec = devContract.accessibilitySpec;
  if (devContract.renderRequirements) {
    next.renderRequirements = {
      mustInclude: [
        ...(next.renderRequirements?.mustInclude || []),
        ...devContract.renderRequirements.mustInclude,
      ],
      forbiddenPatterns: [
        ...(next.renderRequirements?.forbiddenPatterns || []),
        ...devContract.renderRequirements.forbiddenPatterns,
      ],
    };
  }

  return next;
}

function titleFromName(name) {
  return String(name || '')
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function classNameFromComponentName(name) {
  return `thiga-${String(name || 'component')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'component'}`;
}

function buildAutoDiscoveredDefinition(tokens, componentName, allowMissingTokenSubtree = false) {
  const subtree = getNodeByPath(tokens, `component.${componentName}`);
  if (!subtree && !allowMissingTokenSubtree) {
    return null;
  }

  const title = titleFromName(componentName);

  return {
    name: componentName,
    title,
    htmlTag: 'div',
    role: null,
    requiresFigma: true,
    interactive: false,
    autoDiscovered: true,
    semanticHtmlKnown: false,
    summary: `${title} Thiga auto-detecte depuis tokens.json et le cache Figma.`,
    allowedProps: [],
    slots: [],
    variants: [],
    sizes: [],
    states: [],
    usageRules: {
      do: [],
      dont: [],
    },
    accessibility: [],
    accessibilitySpec: null,
    previewMatrix: {},
    renderRequirements: {
      mustInclude: [
        `Utiliser une classe racine .${classNameFromComponentName(componentName)}.`,
        'Representer les axes detectes dans Figma quand ils existent.',
        'Conserver le HTML, le CSS et la logique JS dans un seul bloc react-live.',
      ],
      forbiddenPatterns: [
        'Aucun import, export, asset externe ou URL.',
        'Aucune CSS var non fournie dans allowedCssVars.',
        'Aucun fallback de variable CSS.',
      ],
    },
    requiredTokenPaths: [],
  };
}

function normalizeComponentLookup(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function componentLookupCandidates(value) {
  const raw = String(value || '');
  return new Set([
    normalizeComponentLookup(raw),
    normalizeComponentLookup(raw.split('/').pop()),
  ].filter(Boolean));
}

function findDiscoveredFigmaComponent(figmaCache, componentName) {
  const expected = componentLookupCandidates(componentName);
  return (figmaCache?._meta?.discovered_components || []).find((item) =>
    [...componentLookupCandidates(item?.name)].some((candidate) => expected.has(candidate))
  ) || null;
}

function resolveDefinition(registry, tokens, componentName, figmaCache = null) {
  const figmaComponent = findDiscoveredFigmaComponent(figmaCache, componentName);
  const definition = registry[componentName]
    || buildAutoDiscoveredDefinition(tokens, componentName)
    || (figmaComponent ? buildAutoDiscoveredDefinition(tokens, componentName, true) : null);
  return applyDevContract(definition, extractTokenDevContract(tokens, componentName));
}

function normalizeComparableValue(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function collectBlueprintValues(node, output = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectBlueprintValues(item, output));
    return output;
  }
  if (node && typeof node === 'object') {
    Object.values(node).forEach((item) => collectBlueprintValues(item, output));
    return output;
  }
  const comparable = normalizeComparableValue(node);
  if (comparable !== null) output.add(comparable);
  return output;
}

function buildBlueprintTokenEntries(tokens, blueprint) {
  const blueprintValues = collectBlueprintValues(blueprint);
  return flattenTokenTree(tokens)
    .map((token) => {
      const resolvedValue = resolveTokenValue(tokens, token.value);
      if (!blueprintValues.has(normalizeComparableValue(resolvedValue))) return null;
      return buildTokenEntry(tokens, token.tokenPath);
    })
    .filter(Boolean);
}

function completeDefinitionFromBlueprint(definition, figmaBlueprint) {
  if (!definition?.autoDiscovered || !figmaBlueprint?.axes) {
    return definition;
  }

  const axes = figmaBlueprint.axes || {};
  const variants = axes.variant || axes.style || axes.type || axes.tone || axes.intent || [];
  const sizes = axes.size || [];
  const states = axes.state || [];

  return {
    ...definition,
    axes,
    variants,
    sizes,
    states,
    previewMatrix: {
      axes: Object.keys(axes),
      variantAxis: variants.length ? 'variant' : null,
      sizeAxis: sizes.length ? 'size' : null,
      stateAxis: states.length ? 'state' : null,
    },
    renderRequirements: {
      ...definition.renderRequirements,
      mustInclude: [
        ...(definition.renderRequirements?.mustInclude || []),
        ...Object.entries(axes).map(([axis, values]) => `Axe ${axis}: ${values.join(', ')}.`),
      ],
    },
  };
}

function countRequiredButtonCombos(definition, figmaBlueprint) {
  let count = 0;
  for (const variant of definition.variants || []) {
    for (const state of definition.states || []) {
      for (const size of definition.sizes || []) {
        if (figmaBlueprint?.variants?.[variant]?.[state]?.[size]) {
          count += 1;
        }
      }
    }
  }
  return count;
}

function countRequiredCardCombos(definition, figmaBlueprint) {
  const expectedMedia = ['off', 'on'];
  let count = 0;
  for (const tone of definition.variants || []) {
    for (const media of expectedMedia) {
      for (const state of definition.states || []) {
        if ((figmaBlueprint?.variants || []).some((item) => item.tone === tone && item.media === media && item.state === state)) {
          count += 1;
        }
      }
    }
  }
  return count;
}

function countAxisCombinations(axes = {}) {
  const groups = Object.values(axes).filter((values) => Array.isArray(values) && values.length);
  return groups.length ? groups.reduce((total, values) => total * values.length, 1) : null;
}

function buildJsxBlueprint(definition) {
  if (definition.name === 'button') {
    return {
      strategy: 'compact-button-matrix',
      outline: [
        "Declarer VARIANTS, SIZES et STATES une seule fois depuis le contrat Thiga.",
        "Utiliser des helpers compacts bases uniquement sur les CSS vars exactes de contract.allowedCssVars.",
        "Construire les tailles depuis les variables core space, radius et typography disponibles.",
        "Implementer function Button({ variant, size, state, icon, children }).",
        "Implementer function Demo() qui rend toute la matrice declaree par le contrat Thiga.",
        "Terminer strictement par render(<Demo />);",
      ],
      skeleton: [
        `const VARIANTS = ${JSON.stringify(definition.variants || [])};`,
        `const SIZES = ${JSON.stringify(definition.sizes || [])};`,
        `const STATES = ${JSON.stringify(definition.states || [])};`,
        'Construire les noms uniquement a partir des CSS vars exactes presentes dans contract.allowedCssVars.',
        'function Button({ variant = "primary", size = "md", state = "default", icon = true, children = "Button" }) { /* ... */ }',
        'function Demo() { /* matrice compacte uniquement */ }',
        'render(<Demo />);',
      ],
    };
  }

  if (definition.name === 'card') {
    return {
      strategy: 'card-figma-matrix',
      outline: [
        "Implementer function Card({ style = 'elevated', state = 'default' }).",
        "Utiliser exactement les axes Thiga: Style elevated/outlined et State default/hover/disabled.",
        "Respecter le contenu, les dimensions et les espacements du composant Figma.",
        "Terminer strictement par render(<Demo />);",
      ],
      skeleton: [
        `const STYLES = ${JSON.stringify(definition.variants || [])};`,
        `const STATES = ${JSON.stringify(definition.states || [])};`,
        'function Card({ style = "elevated", state = "default", children, className = "" }) { /* ... */ }',
        'function Demo() { return <div>{/* matrice style/state Thiga */}</div>; }',
        'render(<Demo />);',
      ],
    };
  }

  return {
    strategy: 'generic-token-driven-component',
    outline: [
      `Implementer function ${titleFromName(definition.name).replace(/\s+/g, '') || 'Component'}({ children, className }) autour d'un <${definition.htmlTag}>.`,
      `Utiliser une classe racine .${classNameFromComponentName(definition.name)} et des sous-classes scopees.`,
      'Rendre les variantes Figma detectees via des arrays compacts quand des axes existent.',
      "S'appuyer uniquement sur les CSS vars autorisees par le contrat MCP.",
      'Terminer strictement par render(<Demo />);',
    ],
    skeleton: [
      `const css = \`.${classNameFromComponentName(definition.name)} { /* vars MCP uniquement */ }\`;`,
      'const AXES = { /* reprendre uniquement component.previewMatrix/figma.blueprint.axes */ };',
      `function ${titleFromName(definition.name).replace(/\s+/g, '') || 'Component'}(props) { return <${definition.htmlTag} className="${classNameFromComponentName(definition.name)}">...</${definition.htmlTag}>; }`,
      'function Demo() { /* demo compacte et exhaustive si axes presents */ }',
      'render(<Demo />);',
    ],
  };
}

export function loadRegistry(registryDir) {
  const componentsDir = path.join(registryDir, 'components');
  const files = fs.readdirSync(componentsDir).filter((file) => file.endsWith('.json'));
  const accessibility = JSON.parse(fs.readFileSync(path.join(registryDir, 'accessibility-contracts.json'), 'utf8'));
  const accessibilityTarget = String(accessibility.target || '').trim();
  if (!accessibilityTarget) throw new Error('Cible du contrat accessibilite absente');

  return files.reduce((acc, file) => {
    const fullPath = path.join(componentsDir, file);
    const definition = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    definition.accessibilitySpec = normalizeAccessibilitySpec(
      accessibility.components?.[definition.name],
      'registry:accessibility-contracts.json',
    );
    definition.accessibilityTarget = accessibilityTarget;
    acc[definition.name] = definition;
    return acc;
  }, {});
}

export function listComponentSummaries(registry, tokens = {}, figmaCache = null) {
  const components = { ...registry };
  for (const componentName of Object.keys(tokens.component || {})) {
    components[componentName] ||= buildAutoDiscoveredDefinition(tokens, componentName);
  }
  for (const discovered of figmaCache?._meta?.discovered_components || []) {
    const componentName = String(discovered?.name || '').trim();
    if (!componentName) continue;
    const discoveredCandidates = componentLookupCandidates(componentName);
    const existingName = Object.keys(components).find((name) =>
      [...componentLookupCandidates(name)].some((candidate) => discoveredCandidates.has(candidate))
    );
    if (!existingName) {
      const generatedName = componentName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (generatedName) components[generatedName] = buildAutoDiscoveredDefinition(tokens, generatedName, true);
    }
  }

  return Object.values(components).filter(Boolean).map((component) => ({
    name: component.name,
    title: component.title,
    htmlTag: component.htmlTag,
    semanticHtmlKnown: component.semanticHtmlKnown !== false,
    summary: component.summary,
    autoDiscovered: component.autoDiscovered === true,
  }));
}

export function buildGenerationContext(registry, tokens, componentName, figmaCache = null) {
  let definition = resolveDefinition(registry, tokens, componentName, figmaCache);
  if (!definition) {
    return null;
  }

  const isCssValueEntry = (item) => {
    if (!item) return false;
    if (typeof item.rawValue === 'string' && /^\{.+\}$/.test(item.rawValue) && item.resolvedValue === item.rawValue) {
      return false;
    }
    if (item.resolvedValue && typeof item.resolvedValue === 'object' && !String(item.type || '').includes('shadow')) {
      return false;
    }
    return item.resolvedValue !== null && item.resolvedValue !== undefined;
  };
  const figmaMatch = findFigmaSpec(figmaCache, definition);
  const relatedFigmaSpecs = findRelatedFigmaSpecs(figmaCache, figmaMatch?.key || definition.title);
  const figmaBlueprint = extractDesignBlueprint(figmaMatch?.key || definition.title, figmaMatch?.spec || null, relatedFigmaSpecs);
  definition = applyDevContract(definition, extractFigmaDevContract(figmaMatch?.spec || null));
  definition = completeDefinitionFromBlueprint(definition, figmaBlueprint);
  const componentTokens = buildComponentTokenEntries(tokens, componentName).filter(isCssValueEntry);
  const explicitReferencedTokens = (definition.requiredTokenPaths || [])
    .map((tokenPath) => buildTokenEntry(tokens, tokenPath))
    .filter(isCssValueEntry);
  const blueprintTokens = buildBlueprintTokenEntries(tokens, figmaBlueprint).filter(isCssValueEntry);
  const referencedTokens = [...explicitReferencedTokens, ...blueprintTokens]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.tokenPath === item.tokenPath) === index);
  const extraAllowedCssVars = Array.isArray(definition.extraAllowedCssVars) ? definition.extraAllowedCssVars : [];
  const allowedCssVars = [
    ...componentTokens.map((item) => item.cssVar),
    ...referencedTokens.map((item) => item.cssVar),
    ...extraAllowedCssVars,
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();
  const designSpecDepth = figmaBlueprint ? 1 : 3;
  const jsxBlueprint = buildJsxBlueprint(definition);
  const expectedVariantCount = definition.name === 'button'
    ? (definition.variants || []).length * (definition.sizes || []).length * (definition.states || []).length
    : countAxisCombinations(definition.axes || figmaBlueprint?.axes || {});
  const actualVariantCount = definition.name === 'button'
    ? countRequiredButtonCombos(definition, figmaBlueprint)
    : figmaBlueprint?.variantCount ?? null;
  const figmaComplete = !!figmaMatch
    && !!figmaBlueprint
    && (expectedVariantCount === null || actualVariantCount === expectedVariantCount);

  return {
    component: {
      name: definition.name,
      title: definition.title,
      rootClass: classNameFromComponentName(definition.name),
      htmlTag: definition.htmlTag,
      semanticHtmlKnown: definition.semanticHtmlKnown !== false,
      devContractSource: definition.devContractSource || null,
      role: definition.role,
      requiresFigma: definition.requiresFigma === true,
      interactive: definition.interactive,
      autoDiscovered: definition.autoDiscovered === true,
      summary: definition.summary,
      allowedProps: definition.allowedProps || [],
      slots: definition.slots || [],
      axes: definition.axes || {},
      variants: definition.variants || [],
      sizes: definition.sizes || [],
      states: definition.states || [],
      usageRules: definition.usageRules || { do: [], dont: [] },
      accessibility: definition.accessibility || [],
      accessibilitySpec: {
        target: definition.accessibilityTarget || registry.button?.accessibilityTarget || 'WCAG 2.2 AA — objectif de revue, pas attestation de conformité',
        ...(definition.accessibilitySpec || {
          source: 'missing-contract',
          requirements: [],
          manualChecks: ['Définir la sémantique, le nom accessible, le clavier, le focus et les états avant la production.'],
          reviewRequired: true,
        }),
      },
      assetPath: definition.assetPath || null,
      previewMatrix: definition.previewMatrix || {},
      renderRequirements: definition.renderRequirements || null,
    },
    figma: {
      available: !!figmaMatch,
      source: figmaCache?._meta?.source || null,
      cachedAt: figmaCache?._meta?.cached_at || null,
      matchedKey: figmaMatch?.key || null,
      designSpec: summarizeDesignSpec(figmaMatch?.spec || null, 0, designSpecDepth),
      relatedSpecs: Object.fromEntries(
        relatedFigmaSpecs.map(({ key, spec }) => [key, summarizeDesignSpec(spec || null, 0, 2)])
      ),
      blueprint: figmaBlueprint,
      complete: figmaComplete,
      expectedVariantCount,
      actualVariantCount,
    },
    contract: {
      componentTokens,
      referencedTokens,
      extraAllowedCssVars,
      allowedCssVars,
    },
    outputRequirements: {
      format: 'Markdown',
      requiredSections: ['## Description', '## Spec', "## Do & Don't", '## Code interactif (Live Editor)'],
      jsxRule: `The root JSX element must be <${definition.htmlTag}> or wrap a <${definition.htmlTag}> root component.`,
      generationPolicy: [
        'Use only CSS variables listed in allowedCssVars.',
        'Do not invent variants, sizes, states or props.',
        'Keep the rendered preview exhaustive across the declared matrix.',
        'If figma.designSpec is present, it is the visual source of truth.',
        'If figma.designSpec is missing, explicitly say it in the Spec section instead of inventing visual details.',
      ],
      jsxBlueprint,
    },
  };
}
