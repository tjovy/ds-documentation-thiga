import { transform } from 'sucrase';
import { buildExactPreviewCode, buildGenericPreview } from './exact-preview.js';

const EXPECTED_SECTIONS = [
  'description',
  'spec',
  "do & don't",
  'code interactif (live editor)',
];

function extractTextContent(input) {
  if (!input) return '';
  if (typeof input === 'string') return input;
  return JSON.stringify(input, null, 2);
}

function normalizeHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
}

export function extractCodeBlocks(markdown) {
  const source = extractTextContent(markdown);
  return [...source.matchAll(/```([a-z0-9-]*)\s*\n([\s\S]*?)```/gi)].map((match) => ({
    language: String(match[1] || '').toLowerCase(),
    code: match[2].trim(),
  }));
}

export function extractCodeBlock(markdown) {
  return extractCodeBlocks(markdown)[0]?.code || '';
}

export function validateMarkdownSections(markdown) {
  const source = extractTextContent(markdown);
  const headings = [...source.matchAll(/^##\s+(.+)$/gm)].map((match) => normalizeHeading(match[1]));
  return {
    headings,
    exact: headings.length === EXPECTED_SECTIONS.length
      && headings.every((heading, index) => heading === EXPECTED_SECTIONS[index]),
  };
}

export function extractCssVars(code) {
  return [...new Set(
    [...String(code || '').matchAll(/var\(\s*(--[a-z0-9-]+)(?:\s*,[^)]*)?\s*\)/gi)]
      .map((match) => match[1].toLowerCase())
  )].sort();
}

export function extractLiteralValues(code, propName) {
  const regex = new RegExp(`${propName}\\s*=\\s*["']([a-z0-9-]+)["']`, 'gi');
  return [...new Set([...code.matchAll(regex)].map((match) => match[1].toLowerCase()))].sort();
}

export function extractStringArrayValues(code, variableName) {
  const regex = new RegExp(`(?:const|let|var)\\s+${variableName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'i');
  const match = code.match(regex);
  if (!match) return [];
  return [...new Set([...match[1].matchAll(/["']([a-z0-9-]+)["']/gi)].map((item) => item[1].toLowerCase()))].sort();
}

function sameValues(actual, expected) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected || [])].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compileJsx(code) {
  try {
    transform(code, { transforms: ['jsx', 'imports'] });
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error?.message || String(error) };
  }
}

function includesCssLength(code, value, context) {
  if (new RegExp(`(?:^|[^0-9])${value}px(?:[^0-9]|$)`).test(code)) return true;

  const contractTokens = [
    ...(context?.contract?.componentTokens || []),
    ...(context?.contract?.referencedTokens || []),
  ];
  return contractTokens.some((token) => {
    if (String(token?.resolvedValue) !== `${value}px` || !token?.cssVar) return false;
    const escaped = token.cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`var\\(\\s*${escaped}\\s*\\)`, 'i').test(code);
  });
}

function validateVisualContract(code, component, context) {
  if (component.name === 'button') {
    const requiredLengths = [13, 16, 18, 20, 22, 36, 44, 52, 88, 108, 128];
    return {
      exactLabel: /["']Button["']/.test(code),
      exactIcon: />\s*\+\s*</.test(code) || /"glyph"\s*:\s*"\+"/.test(code),
      iconEnabled: !/\bicon\s*=\s*false\b|\bicon=\{false\}/.test(code),
      noAxisLabelAsContent: !/\{\s*variant\s*\}\s*\{\s*size\s*\}|\{\s*size\s*\}\s*\{\s*state\s*\}/.test(code),
      requiredLengths,
      missingLengths: requiredLengths.filter((value) => !includesCssLength(code, value, context)),
    };
  }

  if (component.name === 'card') {
    const normalized = String(code).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const requiredLengths = [8, 14, 16, 18, 20, 25, 120, 168, 280, 304, 320];
    return {
      exactTitle: normalized.includes('Restaurant & Bars'),
      exactDescription: normalized.includes('Une carte editable pour mettre en avant une destination, une offre ou une section de menu.'),
      requiredLengths,
      missingLengths: requiredLengths.filter((value) => !includesCssLength(code, value, context)),
    };
  }

  return { applicable: false, missingLengths: [] };
}

function validateAxes(code, component) {
  const checks = {};
  const declaredAxes = Object.entries(component.axes || {});
  const axes = declaredAxes.length
    ? Object.fromEntries(
      declaredAxes.map(([axis, values]) => [
        axis.endsWith('s') ? axis : `${axis}s`,
        values,
      ])
    )
    : { variants: component.variants || [], sizes: component.sizes || [], states: component.states || [] };

  for (const [arrayName, expected] of Object.entries(axes)) {
    if (!expected?.length) continue;
    const propName = arrayName === 'tones' ? 'tone' : arrayName.replace(/s$/, '');
    const actual = [
      ...extractStringArrayValues(code, arrayName),
      ...extractStringArrayValues(code, arrayName.toUpperCase()),
      ...extractLiteralValues(code, propName),
    ];
    checks[arrayName] = {
      expected: [...expected].sort(),
      actual: [...new Set(actual)].sort(),
      exact: sameValues(actual, expected),
    };
  }

  return checks;
}

export function validateComponentMarkdown(markdown, context, options = {}) {
  const source = extractTextContent(markdown);
  const sections = validateMarkdownSections(source);
  const blocks = extractCodeBlocks(source);
  const code = blocks[0]?.code || '';
  const cssVars = extractCssVars(code);
  const allowedCssVars = new Set((context.contract.allowedCssVars || []).map((value) => value.toLowerCase()));
  const unknownCssVars = cssVars.filter((cssVar) => !allowedCssVars.has(cssVar));
  const compilation = compileJsx(code);
  const axes = validateAxes(code, context.component);
  const invalidAxes = Object.entries(axes).filter(([, check]) => !check.exact).map(([name]) => name);
  const hasSingleJsxBlock = blocks.length === 1 && ['jsx', 'js'].includes(blocks[0]?.language);
  const hasCssTemplate = /\bconst\s+css\s*=\s*`[\s\S]*?`;/.test(code);
  const endsWithRender = /render\(\s*<Demo\s*\/>\s*\);\s*$/.test(code);
  const rootTagOk = new RegExp(`<${context.component.htmlTag}\\b`, 'i').test(code);
  const rootClassOk = !context.component.rootClass || new RegExp(`\\b${context.component.rootClass}\\b`, 'i').test(code);
  const hasNativeDisabled = context.component.name !== 'button' || /<button\b[\s\S]*?\bdisabled(?:\s|=|\})/i.test(code);
  const hasCssVarFallback = /var\(\s*--[a-z0-9-]+\s*,/i.test(code);
  const hasDynamicCssVar = /var\([^)]*\$\{|--[a-z0-9-]*\$\{/i.test(code);
  const hardcodedColors = [...new Set([
    ...(code.match(/#[0-9a-f]{3,8}\b/gi) || []),
    ...(code.match(/\b(?:rgb|rgba|hsl|hsla)\s*\([^)]*\)/gi) || []),
  ])];
  const forbiddenPatterns = [
    /\b(?:import|export)\b/,
    /\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(/,
    /\bnew\s+Function\b/,
    /\b(?:window|document|location|localStorage|sessionStorage)\b/,
    /https?:\/\//i,
    /<(?:script|iframe)\b/i,
  ].filter((pattern) => pattern.test(code)).map((pattern) => pattern.source);
  const visualContract = validateVisualContract(code, context.component, context);
  let canonicalPreviews = [];
  try {
    canonicalPreviews = [buildExactPreviewCode(context), buildGenericPreview(context)]
      .filter((preview, index, previews) => typeof preview === 'string' && preview.length > 0 && previews.indexOf(preview) === index);
  } catch {
    canonicalPreviews = [];
  }
  const normalizeCode = (value) => String(value || '').replace(/\r\n/g, '\n').trim();
  const exactPreviewApplicable = canonicalPreviews.length > 0;
  const exactPreviewMatch = !exactPreviewApplicable || canonicalPreviews.some((preview) => normalizeCode(code) === normalizeCode(preview));
  const allowVisualApproximation = options.allowVisualApproximation === true;
  // A complete Figma tree is compared byte-for-byte with the canonical
  // renderer below. The old Button/Card checks are retained for pre-tree
  // caches, but must not reject a structurally complete new component.
  const hasCanonicalTree = Boolean(context?.figma?.blueprint?.tree);
  const visualContractOk = hasCanonicalTree
    ? true
    : context.component.name === 'button'
    ? visualContract.exactLabel
      && visualContract.exactIcon
      && visualContract.iconEnabled
      && visualContract.noAxisLabelAsContent
      && visualContract.missingLengths.length === 0
    : context.component.name === 'card'
      ? visualContract.exactTitle
        && visualContract.exactDescription
        && visualContract.missingLengths.length === 0
      : true;

  const valid = sections.exact
    && hasSingleJsxBlock
    && compilation.valid
    && hasCssTemplate
    && endsWithRender
    && rootTagOk
    && rootClassOk
    && hasNativeDisabled
    && unknownCssVars.length === 0
    && invalidAxes.length === 0
    && !hasCssVarFallback
    && !hasDynamicCssVar
    && hardcodedColors.length === 0
    && forbiddenPatterns.length === 0
    && (allowVisualApproximation || visualContractOk)
    && (allowVisualApproximation || exactPreviewMatch);

  return {
    valid,
    checks: {
      sections,
      hasSingleJsxBlock,
      compilation,
      hasCssTemplate,
      endsWithRender,
      rootTagOk,
      rootClassOk,
      hasNativeDisabled,
      axes,
      invalidAxes,
      cssVars,
      unknownCssVars,
      hasCssVarFallback,
      hasDynamicCssVar,
      hardcodedColors,
      forbiddenPatterns,
      visualContract,
      visualContractOk,
      exactPreviewApplicable,
      exactPreviewMatch,
      allowVisualApproximation,
      visualReviewRequired: allowVisualApproximation && (!visualContractOk || !exactPreviewMatch),
    },
  };
}
