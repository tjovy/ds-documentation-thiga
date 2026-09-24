import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildExactPreviewCode, enforceExactFigmaPreview } from '../src/lib/exact-preview.js';
import { loadFigmaCache } from '../src/lib/figma.js';
import { validateComponentMarkdown } from '../src/lib/markdown.js';
import { buildGenerationContext, loadRegistry } from '../src/lib/registry.js';
import { normalizeDesignTokens } from '../../../scripts/lib/token-normalizer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const registry = loadRegistry(path.join(repoRoot, 'tools', 'ds-component-mcp', 'registry'));
const tokens = normalizeDesignTokens(JSON.parse(fs.readFileSync(path.join(repoRoot, 'tokens.json'), 'utf8')));
const figmaCache = loadFigmaCache(path.join(repoRoot, 'n8n', 'cache', 'figma-design-specs.json'));
const markdown = `## Description
Description MCP.

## Spec
- Specification MCP.

## Do & Don't
- Do suivre Figma.
- Don't inventer.

## Code interactif (Live Editor)
\`\`\`jsx
const css = \`\`;
const Demo = () => <div />;
render(<Demo />);
\`\`\``;

function exact(name) {
  const context = buildGenerationContext(registry, tokens, name, figmaCache);
  const output = enforceExactFigmaPreview(markdown, context);
  return { context, output, validation: validateComponentMarkdown(output.markdown, context) };
}

test('loads the 24 Thiga Button combinations from Figma', () => {
  const { context, output, validation } = exact('button');
  assert.deepEqual(context.component.variants, ['primary', 'secondary']);
  assert.deepEqual(context.component.sizes, ['sm', 'md', 'lg']);
  assert.deepEqual(context.component.states, ['default', 'hover', 'pressed', 'disabled']);
  assert.equal(context.figma.expectedVariantCount, 24);
  assert.equal(context.figma.actualVariantCount, 24);
  assert.equal(context.figma.complete, true);
  assert.equal(output.enforced, true);
  assert.equal(output.exact, true);
  assert.equal(output.warning, null);
  assert.match(output.code, /"label": "Nous contacter"/);
  assert.match(output.code, />\{item.label\}<\/Button>/);
  assert.equal(context.component.accessibilitySpec.source, 'registry:accessibility-contracts.json');
  assert.ok(context.contract.allowedCssVars.includes('--core-02-semantic-color-border-focus'));
  assert.match(output.code, /\.thiga-button:focus-visible\s*\{\s*outline: 2px solid var\(--core-02-semantic-color-border-focus\)/);
  assert.ok(validation.checks.accessibility.staticChecks.every((check) => check.status === 'pass'));
  assert.equal(validation.checks.accessibility.reviewRequired, true);
});

test('flags Figma previews whose production semantics need an explicit accessibility decision', () => {
  const table = exact('dataTable');
  assert.equal(table.context.component.semanticHtmlKnown, false);
  assert.equal(table.context.component.role, null);
  assert.equal(table.validation.checks.accessibility.staticChecks.find((check) => check.id === 'table-structure')?.status, 'gap');
  assert.equal(table.validation.checks.accessibility.reviewRequired, true);

  const list = exact('listItem');
  assert.equal(list.context.component.semanticHtmlKnown, false);
  assert.equal(list.context.component.role, null);
  assert.ok(list.context.component.accessibilitySpec.requirements.some((item) => item.id === 'selection-semantics'));
  assert.ok(list.validation.checks.accessibility.openQuestions.length > 0);
});

test('loads the six Thiga Card combinations without legacy Tone/Media axes', () => {
  const { context, output, validation } = exact('card');
  assert.deepEqual(context.component.axes, {
    style: ['elevated', 'outlined'],
    state: ['default', 'hover', 'disabled'],
  });
  assert.equal(context.figma.expectedVariantCount, 6);
  assert.equal(context.figma.actualVariantCount, 6);
  assert.equal(context.figma.complete, true);
  assert.equal(output.enforced, true);
  assert.equal(output.exact, true);
  assert.equal(output.warning, null);
  assert.deepEqual(validation.checks.hardcodedColors, []);
  assert.equal(validation.valid, true);
});

test('renders vector icons from the exact local Figma asset without inventing SVG geometry', () => {
  const { context, output } = exact('arrowRight');
  assert.equal(context.figma.available, true);
  assert.equal(output.enforced, true);
  assert.equal(output.exact, true);
  assert.equal(output.warning, null);
  assert.match(output.code, /\/assets\/figma\/icon-arrow-right\.svg/);
  assert.doesNotMatch(output.code, /<svg|<path/);
});

test('renders Check from the vector path supplied by Figma', () => {
  const { context, output, validation } = exact('check');
  const figmaPath = context.figma.blueprint.tree.children[0].strokeGeometry[0].path;
  assert.equal(output.exact, true);
  assert.match(output.code, new RegExp(figmaPath.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(output.code, /fill="var\(--core-01-primitives-brand-wine-500\)"/);
  assert.equal(validation.valid, true);
});

test('builds a deterministic preview for a newly discovered simple component', () => {
  const genericContext = {
    component: {
      name: 'menu', title: 'Menu', htmlTag: 'nav', rootClass: 'thiga-menu',
      autoDiscovered: true, axes: { state: ['default', 'hover'] },
    },
    figma: {
      complete: true,
      blueprint: {
        variants: [
          { axes: { state: 'default' } },
          { axes: { state: 'hover' } },
        ],
        tree: {
          name: 'Menu', type: 'COMPONENT_SET', width: '360px', height: '80px', fills: [], strokes: [], children: [
            {
              name: 'State=Default', type: 'COMPONENT', x: '0px', y: '0px', width: '160px', height: '40px',
              fills: [{ type: 'SOLID', color: '#191919' }], strokes: [], children: [
                {
                  name: 'label', type: 'TEXT', x: '12px', y: '10px', width: '80px', height: '20px',
                  characters: 'Menu exact', fills: [{ type: 'SOLID', color: '#ffffff' }], strokes: [],
                  textStyle: { fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }, children: [],
                },
              ],
            },
            {
              name: 'State=Hover', type: 'COMPONENT', x: '200px', y: '0px', width: '160px', height: '40px',
              fills: [{ type: 'SOLID', color: '#242424' }], strokes: [], children: [
                {
                  name: 'label', type: 'TEXT', x: '12px', y: '10px', width: '80px', height: '20px',
                  characters: 'Menu exact', fills: [{ type: 'SOLID', color: '#ffffff' }], strokes: [],
                  textStyle: { fontFamily: 'Inter', fontSize: '14px', fontWeight: 500, lineHeight: '20px' }, children: [],
                },
              ],
            },
          ],
        },
      },
    },
    contract: {
      allowedCssVars: ['--semantic-color-bg-surface', '--semantic-color-bg-surface-hover', '--semantic-color-text-primary', '--core-font-family-sans'],
      componentTokens: [],
      referencedTokens: [
        { tokenPath: 'semantic.color.bg.surface', cssVar: '--semantic-color-bg-surface', resolvedValue: '#191919' },
        { tokenPath: 'semantic.color.bg.surfaceHover', cssVar: '--semantic-color-bg-surface-hover', resolvedValue: '#242424' },
        { tokenPath: 'semantic.color.text.primary', cssVar: '--semantic-color-text-primary', resolvedValue: '#ffffff' },
        { tokenPath: 'core.font.family.sans', cssVar: '--core-font-family-sans', resolvedValue: 'Inter' },
      ],
    },
  };
  const code = buildExactPreviewCode(genericContext);
  assert.match(code, /function Menu/);
  assert.match(code, /function Menu\(\{/);
  assert.match(code, /state = DEFAULT_AXES\["state"\]/);
  assert.match(code, /<nav \{\.\.\.rootProps\} className=/);
  assert.doesNotMatch(code, /function Menu\(\{ variantIndex/);
  assert.match(code, /Menu exact/);
  assert.match(code, /"x": 200/);
  assert.match(code, /semantic-color-bg-surface-hover/);
});

test('returns a review warning instead of stopping on a Figma effect that cannot be exact', () => {
  const approximateContext = {
    component: { name: 'banner', title: 'Banner', htmlTag: 'div', rootClass: 'thiga-banner', axes: {} },
    figma: {
      complete: true,
      blueprint: {
        tree: {
          name: 'Banner', type: 'COMPONENT', width: '120px', height: '40px', fills: [], strokes: [],
          effects: [{ type: 'LAYER_BLUR' }], children: [],
        },
      },
    },
    contract: { allowedCssVars: [], componentTokens: [], referencedTokens: [] },
  };

  const output = enforceExactFigmaPreview(markdown, approximateContext);
  const validation = validateComponentMarkdown(output.markdown, approximateContext, { allowVisualApproximation: true });
  assert.equal(output.enforced, true);
  assert.equal(output.exact, false);
  assert.notEqual(output.markdown, markdown);
  assert.equal(output.warning.code, 'figma_preview_approximate');
  assert.match(output.warning.detail, /Effet Figma non reproductible exactement/);
  assert.equal(output.warning.suggestions.length, 4);
  assert.deepEqual(validation.checks.hardcodedColors, []);
  assert.equal(validation.valid, true);
});
