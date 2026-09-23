const CSS_VAR_ALIASES = [
  ['--borderWidth-default', '--border-width-default'],
  ['--borderWidth-thick', '--border-width-thick'],
  ['--focus-ringWidth', '--button-focus-ring-width'],
  ['--focus-ringOffset', '--button-focus-ring-offset'],
  ['--focus-ringColor', '--button-focus-ring-color'],
  ['--transition-all-150ms', '--button-transition'],
  ['--component-card-bg', '--card-bg'],
  ['--component-card-border', '--card-border'],
  ['--component-card-radius', '--card-radius'],
  ['--component-card-shadow', '--card-shadow'],
  ['--component-card-padding-sm', '--spacing-md'],
  ['--component-card-padding-md', '--spacing-lg'],
  ['--component-card-padding-lg', '--spacing-xl'],
  ['--component-input-borderWidth', '--input-border-width'],
  ['--component-input-radius', '--input-radius']
];

const LITERAL_TO_VAR = [
  ['#ffffff', 'var(--color-bg-primary)'],
  ['#f9fafb', 'var(--color-bg-secondary)'],
  ['#f3f4f6', 'var(--color-bg-tertiary)'],
  ['#eff6ff', 'var(--color-feedback-info-bg)'],
  ['#111827', 'var(--color-text-primary)'],
  ['#1f2937', 'var(--color-neutral-800)'],
  ['#4b5563', 'var(--color-text-secondary)'],
  ['#6b7280', 'var(--color-neutral-500)'],
  ['#9ca3af', 'var(--color-text-tertiary)'],
  ['#d1d5db', 'var(--color-border-strong)'],
  ['#e5e7eb', 'var(--color-border-default)'],
  ['#8e0d9d', 'var(--color-action-primary-bg-default)'],
  ['#2563eb', 'var(--color-action-primary-bg-hover)'],
  ['#1d4ed8', 'var(--color-action-primary-bg-hover)'],
  ['#1e40af', 'var(--color-action-primary-bg-active)'],
  ['#3b82f6', 'var(--color-border-focus)'],
  ['#ef4444', 'var(--color-feedback-error-icon)'],
  ['#dc2626', 'var(--color-action-danger-bg-default)'],
  ['#b91c1c', 'var(--color-action-danger-bg-hover)'],
  ['#991b1b', 'var(--color-action-danger-bg-active)']
];

const HARD_CODED_REPLACEMENTS = [
  [/transition:\s*all\s*0\.2s;?/g, 'transition: var(--button-transition);'],
  [/box-shadow:\s*0\s+4px\s+12px\s+rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.15\s*\);?/g, 'box-shadow: var(--shadow-md);'],
  [/box-shadow:\s*0\s+0\s+0\s+3px\s+rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*0\.1\s*\);?/g, 'box-shadow: 0 0 0 var(--button-focus-ring-width) color-mix(in srgb, var(--button-focus-ring-color) 22%, transparent);'],
  [/box-shadow:\s*0\s+0\s+0\s+3px\s+rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.1\s*\);?/g, 'box-shadow: 0 0 0 var(--button-focus-ring-width) color-mix(in srgb, var(--input-border-error) 22%, transparent);'],
  [/border:\s*1px\s+solid\s+([^;]+);?/g, 'border: var(--border-width-default) solid $1;'],
  [/opacity:\s*0\.5;?/g, 'opacity: var(--opacity-50);'],
  [/border-radius:\s*9999px;?/g, 'border-radius: var(--radius-full);'],
  [/border-radius:\s*12px;?/g, 'border-radius: var(--radius-lg);'],
  [/border-radius:\s*8px;?/g, 'border-radius: var(--radius-md);'],
  [/border-radius:\s*4px;?/g, 'border-radius: var(--radius-sm);'],
  [/min-height:\s*32px;?/g, 'min-height: var(--spacing-8);'],
  [/min-height:\s*40px;?/g, 'min-height: var(--spacing-10);'],
  [/min-height:\s*48px;?/g, 'min-height: var(--spacing-12);'],
  [/padding:\s*'24px'/g, "padding: 'var(--spacing-lg)'"],
  [/gap:\s*'12px'/g, "gap: 'var(--spacing-3)'"],
  [/fontSize:\s*'12px'/g, "fontSize: 'var(--font-size-xs)'"],
  [/fontSize:\s*'16px'/g, "fontSize: 'var(--font-size-md)'"],
  [/marginBottom:\s*'16px'/g, "marginBottom: 'var(--spacing-md)'"],
  [/borderRadius:\s*'12px'/g, "borderRadius: 'var(--radius-lg)'"]
];

export const normalizeCodeSnippetToVariables = (input = '') => {
  let code = String(input).replace(/\r\n/g, '\n');

  code = code.replace(/:root\s*\{[\s\S]*?\}\s*/g, '');

  CSS_VAR_ALIASES.forEach(([from, to]) => {
    code = code.replace(new RegExp(from, 'g'), to);
  });

  LITERAL_TO_VAR.forEach(([literal, token]) => {
    code = code.replace(new RegExp(literal, 'gi'), token);
  });

  HARD_CODED_REPLACEMENTS.forEach(([pattern, replacement]) => {
    code = code.replace(pattern, replacement);
  });

  return code.replace(/\n{3,}/g, '\n\n').trim();
};
