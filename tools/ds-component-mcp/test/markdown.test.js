import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComponentMarkdown } from '../src/lib/markdown.js';
import { buildGenerationContext } from '../src/lib/registry.js';

const context = {
  component: {
    name: 'button', htmlTag: 'button',
    variants: ['primary', 'secondary'], sizes: ['sm', 'md', 'lg'], states: ['default', 'hover', 'pressed', 'disabled'],
  },
  contract: { allowedCssVars: ['--semantic-color-action-primary-default'] },
};

const validMarkdown = `## Description
Bouton Thiga.

## Spec
- Conforme.

## Do & Don't
- Do: utiliser une action.
- Don't: inventer une variante.

## Code interactif (Live Editor)
\`\`\`jsx
const css = \`
.thiga-button { background: var(--semantic-color-action-primary-default); border-radius: 8px; }
.thiga-button[data-size="sm"] { min-width: 88px; height: 36px; font-size: 13px; line-height: 18px; }
.thiga-button[data-size="md"] { min-width: 108px; height: 44px; font-size: 14px; line-height: 20px; }
.thiga-button[data-size="lg"] { min-width: 128px; height: 52px; font-size: 16px; line-height: 22px; }
\`;
const variants = ['primary', 'secondary'];
const sizes = ['sm', 'md', 'lg'];
const states = ['default', 'hover', 'pressed', 'disabled'];
const Button = ({ state, size, icon = true, children = 'Button' }) => <button className="thiga-button" data-size={size} disabled={state === 'disabled'}>{icon ? <span>+</span> : null}{children}</button>;
const Demo = () => <div>{variants.map((variant) => sizes.map((size) => states.map((state) => <Button key={variant + size + state} size={size} state={state} />)))}</div>;
render(<Demo />);
\`\`\``;

test('accepts a compiled, exhaustive button snippet', () => {
  assert.equal(validateComponentMarkdown(validMarkdown, context).valid, true);
});

test('rejects CSS variable fallbacks and invented variables', () => {
  const invalid = validMarkdown.replace(
    'var(--semantic-color-action-primary-default)',
    'var(--invented-color, #fff)',
  );
  const result = validateComponentMarkdown(invalid, context);
  assert.equal(result.valid, false);
  assert.deepEqual(result.checks.unknownCssVars, ['--invented-color']);
  assert.equal(result.checks.hasCssVarFallback, true);
});

test('rejects invalid JSX syntax', () => {
  const invalid = validMarkdown.replace('<button className', '<button><span className');
  assert.equal(validateComponentMarkdown(invalid, context).checks.compilation.valid, false);
});

test('rejects dynamically constructed CSS variable names', () => {
  const invalid = validMarkdown.replace(
    'var(--semantic-color-action-primary-default)',
    'var(--semantic-color-action-${variant}-bg-default)',
  );
  assert.equal(validateComponentMarkdown(invalid, context).checks.hasDynamicCssVar, true);
});

test('rejects a button preview that replaces Figma content with axis labels', () => {
  const invalid = validMarkdown
    .replace("icon = true", "icon = false")
    .replace('{children}</button>', '{variant} {size} {state}</button>');
  const result = validateComponentMarkdown(invalid, context);
  assert.equal(result.valid, false);
  assert.equal(result.checks.visualContract.iconEnabled, false);
});

test('accepts an auto-discovered generic menu snippet', () => {
  const menuContext = {
    component: {
      name: 'menu',
      htmlTag: 'div',
      rootClass: 'thiga-menu',
      autoDiscovered: true,
      semanticHtmlKnown: false,
      axes: { state: ['default', 'hover'] },
    },
    contract: { allowedCssVars: ['--component-menu-bg-default'] },
  };
  const markdown = `## Description
Menu Thiga.

## Spec
- Conforme au blueprint.

## Do & Don't
- Do: utiliser les etats declares.
- Don't: inventer une couleur.

## Code interactif (Live Editor)
\`\`\`jsx
const css = \`.thiga-menu { background: var(--component-menu-bg-default); }\`;
const states = ['default', 'hover'];
function Menu({ state }) { return <div className="thiga-menu" data-state={state}>Menu</div>; }
const Demo = () => <div>{states.map((state) => <Menu key={state} state={state} />)}</div>;
render(<Demo />);
\`\`\``;

  assert.equal(validateComponentMarkdown(markdown, menuContext).valid, true);
});

test('builds an auto-discovered menu context from component tokens', () => {
  const tokens = {
    component: {
      menu: {
        bg: {
          default: { value: '#111111', type: 'color' },
        },
      },
    },
  };
  const figmaCache = {
    _meta: { cached_at: '2026-07-18T00:00:00.000Z', source: 'test' },
    figma_design_specs: {
      Menu: {
        name: 'Menu',
        type: 'COMPONENT_SET',
        children: [
          { name: 'State=Default', type: 'COMPONENT', width: '160px', height: '40px' },
          { name: 'State=Hover', type: 'COMPONENT', width: '160px', height: '40px' },
        ],
      },
    },
  };

  const generated = buildGenerationContext({}, tokens, 'menu', figmaCache);
  assert.equal(generated.component.autoDiscovered, true);
  assert.equal(generated.component.htmlTag, 'div');
  assert.equal(generated.component.semanticHtmlKnown, false);
  assert.deepEqual(generated.component.axes, { state: ['default', 'hover'] });
  assert.equal(generated.figma.complete, true);
  assert.ok(generated.contract.allowedCssVars.includes('--component-menu-bg-default'));
});

test('applies an explicit dev contract from component tokens', () => {
  const tokens = {
    component: {
      menu: {
        $dev: {
          htmlTag: 'nav',
          role: 'navigation',
          interactive: true,
          allowedProps: ['children', 'aria-label'],
          slots: ['item'],
          accessibility: ['Le libelle aria-label est requis si aucun titre visible ne nomme la navigation.'],
          usageRules: {
            do: ['Utiliser pour une navigation principale ou secondaire.'],
            dont: ['Ne pas utiliser pour une simple liste de liens non structuree.'],
          },
        },
        bg: {
          default: { value: '#111111', type: 'color' },
        },
      },
    },
  };

  const generated = buildGenerationContext({}, tokens, 'menu', null);
  assert.equal(generated.component.autoDiscovered, true);
  assert.equal(generated.component.htmlTag, 'nav');
  assert.equal(generated.component.semanticHtmlKnown, true);
  assert.equal(generated.component.devContractSource, 'tokens:component.menu.$dev');
  assert.equal(generated.component.role, 'navigation');
  assert.equal(generated.component.interactive, true);
  assert.deepEqual(generated.component.allowedProps, ['children', 'aria-label']);
  assert.deepEqual(generated.component.slots, ['item']);
});

test('applies an explicit dev contract from Figma description', () => {
  const tokens = {
    component: {
      menu: {
        bg: {
          default: { value: '#111111', type: 'color' },
        },
      },
    },
  };
  const figmaCache = {
    _meta: { cached_at: '2026-07-18T00:00:00.000Z', source: 'test' },
    figma_design_specs: {
      Menu: {
        name: 'Menu',
        type: 'COMPONENT_SET',
        description: '@thiga-dev {"htmlTag":"nav","role":"navigation","interactive":true,"allowedProps":["children","aria-label"],"slots":["item"]}',
        children: [
          { name: 'State=Default', type: 'COMPONENT', width: '160px', height: '40px' },
        ],
      },
    },
  };

  const generated = buildGenerationContext({}, tokens, 'menu', figmaCache);
  assert.equal(generated.component.htmlTag, 'nav');
  assert.equal(generated.component.semanticHtmlKnown, true);
  assert.equal(generated.component.devContractSource, 'figma-description:@thiga-dev');
  assert.equal(generated.component.role, 'navigation');
  assert.equal(generated.component.interactive, true);
  assert.deepEqual(generated.component.allowedProps, ['children', 'aria-label']);
  assert.deepEqual(generated.component.slots, ['item']);
});

test('does not add fallback vars for auto-discovered Figma metadata components', () => {
  const tokens = {
    core: {
      space: {
        16: { value: '16px', type: 'dimension' },
      },
      radius: {
        8: { value: '8px', type: 'dimension' },
      },
      font: {
        family: {
          sans: { value: 'Inter', type: 'fontFamily' },
        },
      },
    },
    semantic: {
      color: {
        bg: {
          surface: { value: '#191919', type: 'color' },
        },
        text: {
          primary: { value: '#ffffff', type: 'color' },
        },
      },
    },
    component: {
      spark: {
        $figma: {
          name: 'Icon/Spark',
          type: 'COMPONENT',
        },
      },
    },
  };
  const figmaCache = {
    _meta: { cached_at: '2026-07-18T00:00:00.000Z', source: 'test' },
    figma_design_specs: {
      Spark: {
        name: 'Icon/Spark',
        type: 'COMPONENT',
        width: '24px',
        height: '24px',
      },
    },
  };

  const generated = buildGenerationContext({}, tokens, 'spark', figmaCache);
  assert.equal(generated.component.autoDiscovered, true);
  assert.equal(generated.component.semanticHtmlKnown, false);
  assert.deepEqual(generated.contract.allowedCssVars, []);
});
