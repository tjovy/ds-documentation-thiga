function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function tokenEntries(context) {
  return [
    ...(context?.contract?.componentTokens || []),
    ...(context?.contract?.referencedTokens || []),
  ].filter((entry) => entry?.cssVar && entry?.resolvedValue !== undefined);
}

function cssVarForValue(context, value, preferredPaths = []) {
  if (!value || value === 'transparent') return 'transparent';
  const expected = normalizeValue(value);
  const matching = tokenEntries(context).filter((entry) => normalizeValue(entry.resolvedValue) === expected);
  for (const path of preferredPaths) {
    const preferred = matching.find((entry) => String(entry.tokenPath).toLowerCase() === path.toLowerCase());
    if (preferred) return `var(${preferred.cssVar})`;
  }
  const semantic = matching.find((entry) => String(entry.tokenPath).startsWith('semantic.'));
  const selected = semantic || matching[0];
  if (!selected) throw new Error(`Aucun token CSS ne correspond a la valeur Figma ${value}`);
  return `var(${selected.cssVar})`;
}

function px(value, fallback = '0px') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return `${value}px`;
  return String(value);
}

function numberFromPx(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function replaceJsxBlock(markdown, code) {
  const source = String(markdown || '');
  const block = /```(?:jsx|js)\s*\n[\s\S]*?```/i;
  if (!block.test(source)) return source;
  return source.replace(block, `\`\`\`jsx\n${code.trim()}\n\`\`\``);
}

function translateShadow(context, shadow) {
  if (!shadow) return 'none';
  const match = String(shadow).match(/^(-?[\d.]+px)\s+(-?[\d.]+px)\s+(-?[\d.]+px)\s+(-?[\d.]+px)\s+rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (!match) throw new Error(`Ombre Figma non supportee: ${shadow}`);
  const hex = `#${[match[5], match[6], match[7]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  const color = cssVarForValue(context, hex, ['core.color.black']);
  const alpha = Math.round(Number(match[8]) * 10000) / 100;
  const shadowColor = alpha >= 100 ? color : `color-mix(in srgb, ${color} ${alpha}%, transparent)`;
  return `${match[1]} ${match[2]} ${match[3]} ${match[4]} ${shadowColor}`;
}

function buttonEntries(context) {
  const blueprint = context.figma.blueprint;
  const entries = [];
  for (const size of context.component.sizes || []) {
    for (const variant of context.component.variants || []) {
      for (const state of context.component.states || []) {
        const spec = blueprint?.variants?.[variant]?.[state]?.[size];
        if (!spec) throw new Error(`Variante Figma Button manquante: ${size}/${variant}/${state}`);
        entries.push({ size, variant, state, spec });
      }
    }
  }
  return entries;
}

function buildButtonPreview(context) {
  const blueprint = context.figma.blueprint;
  const entries = buttonEntries(context);
  const defaultFontFamily = cssVarForValue(
    context,
    entries.find(({ spec }) => spec.label?.fontFamily)?.spec.label.fontFamily,
    ['core.04Typography.family.brand'],
  );
  const shellBackground = cssVarForValue(context, blueprint.shell.background, ['semantic.color.bg.surface']);
  const shellBorder = blueprint.shell.border
    ? cssVarForValue(context, blueprint.shell.border, ['semantic.color.border.default'])
    : 'transparent';
  const css = [
    '.thiga-figma-set--button {',
    `  position: relative;`,
    `  width: ${px(blueprint.shell.width)};`,
    `  height: ${px(blueprint.shell.height)};`,
    `  box-sizing: border-box;`,
    `  overflow: ${blueprint.shell.clipsContent ? 'hidden' : 'visible'};`,
    `  background: ${shellBackground};`,
    `  border: ${px(blueprint.shell.borderWidth)} solid ${shellBorder};`,
    `  border-radius: ${px(blueprint.shell.radius)};`,
    '}',
    '',
    '.thiga-button {',
    '  appearance: none;',
    '  position: absolute;',
    '  box-sizing: border-box;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  margin: 0;',
    '  border-style: solid;',
    `  font-family: ${defaultFontFamily};`,
    '  cursor: pointer;',
    '  outline: none;',
    '  white-space: nowrap;',
    '}',
    '',
    '.thiga-button[disabled] { cursor: not-allowed; }',
    '.thiga-button__icon {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  flex: 0 0 auto;',
    '}',
    '.thiga-button__label { display: block; }',
  ];

  for (const { size, variant, state, spec } of entries) {
    const background = cssVarForValue(context, spec.background, [
      `semantic.color.action.${variant}.${state}`,
      state === 'hover' ? 'semantic.color.bg.surfaceHover' : 'semantic.color.bg.surface',
      'semantic.color.bg.disabled',
    ]);
    const border = spec.border
      ? cssVarForValue(context, spec.border, [
        state === 'hover' ? 'semantic.color.border.brand' : 'semantic.color.border.default',
      ])
      : 'transparent';
    const labelColor = cssVarForValue(context, spec.label?.textColor, [
      state === 'disabled' ? 'semantic.color.text.disabled' : '',
      variant === 'primary' ? 'semantic.color.text.onBrand' : '',
      state === 'hover' ? 'semantic.color.text.brand' : 'semantic.color.text.primary',
    ].filter(Boolean));
    css.push(
      '',
      `.thiga-button--${variant}.thiga-button--${state}.thiga-button--${size} {`,
      `  width: ${px(spec.width)};`,
      `  height: ${px(spec.height)};`,
      `  padding: ${px(spec.padding?.top)} ${px(spec.padding?.right)} ${px(spec.padding?.bottom)} ${px(spec.padding?.left)};`,
      `  gap: ${px(spec.padding?.gap)};`,
      `  border-radius: ${px(spec.radius)};`,
      `  border-width: ${px(spec.borderWidth)};`,
      `  border-color: ${border};`,
      `  background: ${background};`,
      `  opacity: ${spec.opacity ?? 1};`,
      '}',
      `.thiga-button--${variant}.thiga-button--${state}.thiga-button--${size} .thiga-button__label {`,
      `  color: ${labelColor};`,
      `  font-family: ${spec.label?.fontFamily ? cssVarForValue(context, spec.label.fontFamily, ['core.04Typography.family.brand']) : defaultFontFamily};`,
      `  font-size: ${px(spec.label?.fontSize)};`,
      `  font-weight: ${spec.label?.fontWeight || 500};`,
      `  line-height: ${px(spec.label?.lineHeight)};`,
      '}',
    );
    for (const [iconIndex, icon] of (spec.icons?.items || []).entries()) {
      const iconColor = icon.textColor
        ? cssVarForValue(context, icon.textColor, ['semantic.color.icon.default', 'semantic.color.text.onBrand'])
        : 'currentColor';
      css.push(
        `.thiga-button--${variant}.thiga-button--${state}.thiga-button--${size} .thiga-button__icon--${iconIndex} {`,
        `  width: ${px(icon.width, '16px')};`,
        `  height: ${px(icon.height, '16px')};`,
        `  color: ${iconColor};`,
        `  font-family: ${icon.fontFamily ? cssVarForValue(context, icon.fontFamily, ['core.04Typography.family.brand']) : defaultFontFamily};`,
        `  font-size: ${px(icon.fontSize, '14px')};`,
        `  font-weight: ${icon.fontWeight || 700};`,
        `  line-height: ${px(icon.lineHeight, '17px')};`,
        '}',
      );
    }
  }

  const layout = entries.map(({ size, variant, state, spec }) => ({
    size, variant, state,
    x: numberFromPx(spec.x),
    y: numberFromPx(spec.y),
    icons: (spec.icons?.items || []).map((icon) => ({ glyph: icon.glyph || '' })),
    content: spec.icons?.content || [{ type: 'label' }],
  }));

  return `const css = \`\n${css.join('\n')}\n\`;

const VARIANTS = ${JSON.stringify(context.component.variants)};
const SIZES = ${JSON.stringify(context.component.sizes)};
const STATES = ${JSON.stringify(context.component.states)};
const BUTTON_LAYOUT = ${JSON.stringify(layout, null, 2)};

function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  icon,
  children = "Button",
  className = "",
  onClick,
  previewState,
  previewContent,
  previewIcons,
  style,
  ...buttonProps
}) {
  // previewState is used by the Figma matrix only. Application code uses
  // variant, size and the native disabled prop as it would in production.
  const state = previewState || (disabled ? "disabled" : "default");
  const isDisabled = disabled || state === "disabled";
  const icons = previewIcons || (Array.isArray(icon) ? icon : icon ? [icon] : []);
  const content = previewContent || [
    ...icons.map((_, index) => ({ type: "icon", index })),
    { type: "label" },
  ];
  return (
    <button
      {...buttonProps}
      type={type}
      className={["thiga-button", "thiga-button--" + variant, "thiga-button--" + state, "thiga-button--" + size, className].filter(Boolean).join(" ")}
      disabled={isDisabled}
      style={style}
      onClick={onClick}
    >
      {content.map((item, contentIndex) => item.type === "icon" ? (
        <span key={"icon-" + contentIndex} className={"thiga-button__icon thiga-button__icon--" + item.index} aria-hidden="true">{icons[item.index]?.glyph || icons[item.index] || ""}</span>
      ) : (
        <span key={"label-" + contentIndex} className="thiga-button__label">{children}</span>
      ))}
    </button>
  );
}

const Demo = () => (
  <div className="thiga-figma-set--button">
    <style>{css}</style>
    {BUTTON_LAYOUT.map((item) => (
      <Button
        key={\`\${item.size}-\${item.variant}-\${item.state}\`}
        size={item.size}
        variant={item.variant}
        previewState={item.state}
        previewIcons={item.icons}
        previewContent={item.content}
        style={{ left: item.x, top: item.y }}
      />
    ))}
  </div>
);

render(<Demo />);`;
}

function buildFigmaAssetPreview(context) {
  const assetPath = context.component.assetPath;
  const tree = context.figma.blueprint?.tree;
  if (!assetPath || !tree || tree.type !== 'COMPONENT') return null;
  const componentName = safeIdentifier(context.component.title || context.component.name);
  const child = (tree.children || []).find((node) => node.visible !== false);
  const assetWidth = child ? numberFromPx(child.width) + 1.8 : numberFromPx(tree.width);
  const assetHeight = child ? numberFromPx(child.height) + 1.8 : numberFromPx(tree.height);

  return `const css = \`
.${context.component.rootClass} {
  position: relative;
  display: inline-block;
  width: ${px(tree.width)};
  height: ${px(tree.height)};
  overflow: ${tree.clipsContent ? 'hidden' : 'visible'};
  line-height: 0;
}
.${context.component.rootClass}__asset {
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${px(assetWidth)};
  height: ${px(assetHeight)};
  transform: translate(-50%, -50%);
}
\`;

function ${componentName}({ className = "", "aria-label": ariaLabel }) {
  const decorative = !ariaLabel;
  return (
    <span
      className={["${context.component.rootClass}", className].filter(Boolean).join(" ")}
      role={decorative ? undefined : "img"}
      aria-label={ariaLabel}
      aria-hidden={decorative ? "true" : undefined}
    >
      <img className="${context.component.rootClass}__asset" src="${assetPath}" alt="" />
    </span>
  );
}

const Demo = () => <><style>{css}</style><${componentName} aria-label="Flèche vers la droite" /></>;

render(<Demo />);`;
}

function cardTextStyle(lines, selector, node, context, colorPaths) {
  if (!node) return;
  lines.push(
    selector + ' {',
    `  color: ${cssVarForValue(context, node.color, colorPaths)};`,
    `  font-family: ${node.textStyle?.fontFamily ? cssVarForValue(context, node.textStyle.fontFamily, ['core.font.family.sans']) : 'var(--core-font-family-sans)'};`,
    `  font-size: ${px(node.textStyle?.fontSize)};`,
    `  font-weight: ${node.textStyle?.fontWeight || 400};`,
    `  line-height: ${px(node.textStyle?.lineHeight)};`,
    '}',
  );
}

function buildCardPreview(context) {
  const blueprint = context.figma.blueprint;
  const entries = blueprint.variants || [];
  if (!entries.length) throw new Error('Aucune variante Card dans le blueprint Figma');
  const firstMedia = entries.map((entry) => entry.mediaSpec).find(Boolean);
  const firstContent = entries.map((entry) => entry.content).find(Boolean);
  const shellBackground = cssVarForValue(context, blueprint.shell.background, ['semantic.color.bg.surface']);
  const shellBorder = blueprint.shell.border
    ? cssVarForValue(context, blueprint.shell.border, ['semantic.color.border.default'])
    : 'transparent';
  const css = [
    '.thiga-figma-set--card {',
    '  position: relative;',
    `  width: ${px(blueprint.shell.width)};`,
    `  height: ${px(blueprint.shell.height)};`,
    '  box-sizing: border-box;',
    `  background: ${shellBackground};`,
    `  border: ${px(blueprint.shell.borderWidth)} solid ${shellBorder};`,
    `  border-radius: ${px(blueprint.shell.radius)};`,
    '  overflow: hidden;',
    '}',
    '',
    '.thiga-card {',
    '  position: absolute;',
    '  box-sizing: border-box;',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: flex-start;',
    '  margin: 0;',
    '  border-style: solid;',
    '  font-family: var(--core-font-family-sans);',
    '}',
    '.thiga-card__media {',
    '  position: relative;',
    `  width: ${px(firstMedia?.width)};`,
    `  height: ${px(firstMedia?.height)};`,
    `  border-radius: ${px(firstMedia?.radius || firstMedia?.cornerRadii?.[0])};`,
    '  overflow: hidden;',
    '  flex: 0 0 auto;',
    '}',
    '.thiga-card__accent {',
    '  position: absolute;',
    `  left: ${px(firstMedia?.accent?.x)};`,
    `  top: ${px(firstMedia?.accent?.y)};`,
    `  width: ${px(firstMedia?.accent?.width)};`,
    `  height: ${px(firstMedia?.accent?.height)};`,
    `  border-radius: ${px(firstMedia?.accent?.radius)};`,
    `  background: ${cssVarForValue(context, firstMedia?.accent?.background, ['semantic.color.bg.brand'])};`,
    '}',
    '.thiga-card__content {',
    `  width: ${px(firstContent?.width)};`,
    `  max-width: ${px(firstContent?.width)};`,
    '  min-width: 0;',
    '  display: flex;',
    '  flex-direction: column;',
    `  gap: ${px(firstContent?.gap)};`,
    '}',
    `.thiga-card__title { width: ${px(firstContent?.title?.width || firstContent?.width)}; height: ${px(firstContent?.title?.height)}; margin: 0; }`,
    `.thiga-card__description { width: ${px(firstContent?.description?.width || firstContent?.width)}; height: ${px(firstContent?.description?.height)}; margin: 0; white-space: normal; overflow-wrap: normal; }`,
  ];

  for (const entry of entries) {
    const key = `${entry.tone}-${entry.media}-${entry.state}`;
    const background = cssVarForValue(context, entry.background, [
      entry.tone === 'highlight'
        ? entry.state === 'hover' ? 'semantic.color.bg.brand' : 'semantic.color.bg.brandSoft'
        : entry.state === 'hover' ? 'semantic.color.bg.surfaceHover' : 'semantic.color.bg.surface',
    ]);
    const border = cssVarForValue(context, entry.border, [
      entry.state === 'hover' || entry.tone === 'highlight'
        ? 'semantic.color.border.brand'
        : 'semantic.color.border.default',
    ]);
    css.push(
      '',
      `.thiga-card--${key} {`,
      `  width: ${px(entry.width)};`,
      `  height: ${px(entry.height)};`,
      `  padding: ${px(entry.padding?.top)} ${px(entry.padding?.right)} ${px(entry.padding?.bottom)} ${px(entry.padding?.left)};`,
      `  gap: ${px(entry.padding?.gap)};`,
      `  border-radius: ${px(entry.cornerRadius)};`,
      `  border-width: ${px(entry.borderWidth)};`,
      `  border-color: ${border};`,
      `  background: ${background};`,
      `  box-shadow: ${translateShadow(context, entry.shadow)};`,
      '}',
    );
    if (entry.mediaSpec) {
      css.push(
        `.thiga-card--${key} .thiga-card__media {`,
        `  background: ${cssVarForValue(context, entry.mediaSpec.background, [
          entry.tone === 'highlight' ? 'semantic.color.bg.header' : 'semantic.color.bg.elevated',
          'core.color.black',
        ])};`,
        '}',
      );
    }
    cardTextStyle(css, `.thiga-card--${key} .thiga-card__title`, entry.content?.title, context, [
      entry.tone === 'highlight' && entry.state === 'hover' ? 'semantic.color.text.onBrand' : 'semantic.color.text.primary',
    ]);
    cardTextStyle(css, `.thiga-card--${key} .thiga-card__description`, entry.content?.description, context, [
      entry.tone === 'highlight'
        ? entry.state === 'hover' ? 'semantic.color.text.onBrand' : 'semantic.color.text.primary'
        : 'semantic.color.text.secondary',
    ]);
  }

  const layout = entries.map((entry) => ({
    tone: entry.tone,
    media: entry.media,
    state: entry.state,
    x: numberFromPx(entry.x),
    y: numberFromPx(entry.y),
  }));
  const title = entries[0]?.content?.title?.text || 'Restaurant & Bars';
  const description = entries[0]?.content?.description?.text || '';

  return `const css = \`\n${css.join('\n')}\n\`;

const tones = ${JSON.stringify(context.component.variants)};
const media = ${JSON.stringify([...new Set(entries.map((entry) => entry.media))])};
const states = ${JSON.stringify(context.component.states)};
const CARD_LAYOUT = ${JSON.stringify(layout, null, 2)};

function Card({ tone = "default", media = "off", state = "default", children, className = "", previewStyle }) {
  const key = \`\${tone}-\${media}-\${state}\`;
  return (
    <article className={["thiga-card", "thiga-card--" + key, className].filter(Boolean).join(" ")} style={previewStyle}>
      {media === "on" ? (
        <div className="thiga-card__media" aria-hidden="true">
          <span className="thiga-card__accent" />
        </div>
      ) : null}
      {children || (
        <div className="thiga-card__content">
          <h3 className="thiga-card__title">${title}</h3>
          <p className="thiga-card__description">${description}</p>
        </div>
      )}
    </article>
  );
}

const Demo = () => (
  <div className="thiga-figma-set--card">
    <style>{css}</style>
    {CARD_LAYOUT.map((item) => (
      <Card
        key={\`\${item.tone}-\${item.media}-\${item.state}\`}
        tone={item.tone}
        media={item.media}
        state={item.state}
        previewStyle={{ left: item.x, top: item.y }}
      />
    ))}
  </div>
);

render(<Demo />);`;
}

function buildSparkPreview(context) {
  const blueprint = context.figma.blueprint;
  const text = blueprint.textNodes?.find((node) => node.characters) || blueprint.textNodes?.[0];
  if (!text) throw new Error('Texte Figma Icon/Spark manquant');
  const shell = blueprint.shell;
  const color = cssVarForValue(context, text.fills?.[0]?.color, ['semantic.color.icon.default', 'core.color.white']);
  return `const css = \`
.thiga-spark-demo {
  display: inline-flex;
  padding: 16px;
}
.thiga-spark {
  position: relative;
  width: ${px(shell.width)};
  height: ${px(shell.height)};
  flex: 0 0 auto;
}
.thiga-spark__glyph {
  position: absolute;
  left: ${px(text.x)};
  top: ${px(text.y)};
  width: ${px(text.width)};
  height: ${px(text.height)};
  color: ${color};
  font-family: ${text.textStyle?.fontFamily ? cssVarForValue(context, text.textStyle.fontFamily, ['core.font.family.sans']) : 'var(--core-font-family-sans)'};
  font-size: ${px(text.textStyle?.fontSize)};
  font-weight: ${text.textStyle?.fontWeight || 700};
  line-height: ${px(text.textStyle?.lineHeight)};
}\`;

function Spark() {
  return <div className="thiga-spark" aria-hidden="true"><span className="thiga-spark__glyph">${text.characters}</span></div>;
}

const Demo = () => <div className="thiga-spark-demo"><style>{css}</style><Spark /></div>;

render(<Demo />);`;
}

function safeIdentifier(value) {
  const cleaned = String(value || 'Component').replace(/[^a-zA-Z0-9_$]+/g, ' ')
    .split(/\s+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('');
  return /^[a-zA-Z_$]/.test(cleaned) ? cleaned : `Component${cleaned}`;
}

function safeClassPart(value) {
  return String(value || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'node';
}

function genericNodeBackground(context, node) {
  const fills = (node.fills || []).filter((fill) => fill?.type);
  if (!fills.length) return null;
  if (fills.some((fill) => fill.type !== 'SOLID')) {
    throw new Error(`Fill Figma ${fills.map((fill) => fill.type).join(',')} non reproductible exactement pour ${node.name}`);
  }
  return cssVarForValue(context, fills[0].color);
}

function genericNodeShadow(context, node) {
  const effects = node.effects || [];
  if (!effects.length) return null;
  if (effects.some((effect) => !['DROP_SHADOW', 'INNER_SHADOW'].includes(effect.type) || !effect.css)) {
    throw new Error(`Effet Figma non reproductible exactement pour ${node.name}`);
  }
  return effects.map((effect) => `${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${translateShadow(context, effect.css.replace(/^inset\s+/, ''))}`).join(', ');
}

function renderGenericNode(node, context, state, options = {}) {
  const supported = new Set([
    'FRAME',
    'COMPONENT_SET',
    'COMPONENT',
    'INSTANCE',
    'RECTANGLE',
    'GROUP',
    'TEXT',
    'ELLIPSE',
    'POLYGON',
    'STAR',
    'LINE',
    'BOOLEAN_OPERATION',
    'SHAPE_WITH_TEXT',
  ]);
  if (!supported.has(node.type)) {
    throw new Error(`Type Figma ${node.type} non reproductible exactement pour ${node.name}`);
  }
  const index = state.index++;
  const className = `${context.component.rootClass}__figma-${index}-${safeClassPart(node.name)}`;
  const lines = [`.${className} {`, `  position: ${options.root ? 'absolute' : 'absolute'};`, '  box-sizing: border-box;'];
  if (options.root && context.component.htmlTag === 'button') {
    lines.push('  appearance: none;', '  margin: 0;', '  padding: 0;');
  }
  if (!options.root) {
    lines.push(`  left: ${px(node.x)};`, `  top: ${px(node.y)};`);
  }
  lines.push(`  width: ${px(node.width)};`, `  height: ${px(node.height)};`);
  const background = node.type === 'TEXT' ? null : genericNodeBackground(context, node);
  if (background) lines.push(`  background: ${background};`);
  const stroke = (node.strokes || []).find((item) => item?.color);
  if (stroke) {
    lines.push(`  border: ${px(stroke.weight)} solid ${cssVarForValue(context, stroke.color)};`);
  } else {
    lines.push('  border: 0;');
  }
  if (node.cornerRadius || node.cornerRadii?.length) {
    const radii = node.cornerRadii?.length ? node.cornerRadii.map((value) => px(value)).join(' ') : px(node.cornerRadius);
    lines.push(`  border-radius: ${radii};`);
  }
  if (node.type === 'ELLIPSE') lines.push('  border-radius: 50%;');
  const shadow = genericNodeShadow(context, node);
  if (shadow) lines.push(`  box-shadow: ${shadow};`);
  lines.push(`  opacity: ${node.opacity ?? 1};`);
  if (node.clipsContent) lines.push('  overflow: hidden;');
  if (node.visible === false) {
    lines.push('  display: none;');
  } else if (node.children?.length) {
    lines.push('  display: block;');
  }
  if (node.type === 'TEXT') {
    lines.push(
      `  display: ${node.visible === false ? 'none' : 'block'};`,
      '  margin: 0;',
      '  white-space: pre-wrap;',
      '  overflow-wrap: normal;',
      `  color: ${cssVarForValue(context, node.fills?.[0]?.color)};`,
      `  font-family: ${cssVarForValue(context, node.textStyle?.fontFamily, ['core.font.family.sans'])};`,
      `  font-size: ${px(node.textStyle?.fontSize)};`,
      `  font-weight: ${node.textStyle?.fontWeight || 400};`,
      `  line-height: ${px(node.textStyle?.lineHeight)};`,
      `  letter-spacing: ${node.textStyle?.letterSpacing || '0'};`,
      `  text-align: ${node.textStyle?.textAlign || 'left'};`,
    );
  }
  lines.push('}');
  state.css.push(...lines, '');

  if (node.type === 'TEXT') {
    return `<span className="${className}">{${JSON.stringify(node.characters || '')}}</span>`;
  }
  const children = (node.children || []).map((child) => renderGenericNode(child, context, state)).join('\n');
  if (options.root) {
    const tag = context.component.htmlTag || 'div';
    const disabled = tag === 'button' && options.axes?.state === 'disabled' ? ' disabled={true}' : '';
    return `<${tag} {...rootProps} className={[${JSON.stringify(context.component.rootClass)}, ${JSON.stringify(className)}, className].filter(Boolean).join(" ")} style={previewStyle}${disabled}>\n${children}\n</${tag}>`;
  }
  return `<div className="${className}">\n${children}\n</div>`;
}

export function buildGenericPreview(context) {
  const tree = context.figma.blueprint?.tree;
  if (!tree) return null;
  const isSet = tree.type === 'COMPONENT_SET';
  const variants = isSet ? tree.children || [] : [tree];
  if (!variants.length) throw new Error(`Aucun noeud Figma pour ${context.component.name}`);
  const state = { index: 0, css: [] };
  const canvasClass = `thiga-figma-set--${safeClassPart(context.component.name)}`;
  const canvasBackground = isSet ? genericNodeBackground(context, tree) : null;
  const canvasStroke = isSet ? (tree.strokes || []).find((item) => item?.color) : null;
  state.css.push(
    `.${canvasClass} {`,
    '  position: relative;',
    `  width: ${px(tree.width)};`,
    `  height: ${px(tree.height)};`,
    '  box-sizing: border-box;',
    ...(canvasBackground ? [`  background: ${canvasBackground};`] : []),
    ...(canvasStroke ? [`  border: ${px(canvasStroke.weight)} solid ${cssVarForValue(context, canvasStroke.color)};`] : []),
    ...(isSet && tree.cornerRadius ? [`  border-radius: ${px(tree.cornerRadius)};`] : []),
    `  overflow: ${tree.clipsContent ? 'hidden' : 'visible'};`,
    '}',
    '',
  );

  const rendered = variants.map((variant, variantIndex) => {
    const variantMetadata = context.figma.blueprint.genericVariants
      || context.figma.blueprint.variants
      || [];
    const axes = variantMetadata?.[variantIndex]?.axes || {};
    return {
      axes,
      x: numberFromPx(variant.x),
      y: numberFromPx(variant.y),
      jsx: renderGenericNode(variant, context, state, { root: true, axes }),
    };
  });
  const componentName = safeIdentifier(context.component.title || context.component.name);
  const layerName = `${componentName}FigmaLayer`;
  const cases = rendered.map((item, index) => `    case ${index}: return (\n${item.jsx.split('\n').map((line) => `      ${line}`).join('\n')}\n    );`).join('\n');
  // These arrays expose the MCP contract for validation and review. They do
  // not influence rendering: each rendered case still comes solely from the
  // Figma tree above.
  const axisConstants = new Map();
  for (const [axis, values] of Object.entries(context.component.axes || {})) {
    const name = axis === 'media' ? 'media' : axis.endsWith('s') ? axis : `${axis}s`;
    axisConstants.set(name, values);
  }
  if (!context.component.autoDiscovered && !Object.keys(context.component.axes || {}).length) {
    axisConstants.set('variants', context.component.variants || []);
    axisConstants.set('sizes', context.component.sizes || []);
    axisConstants.set('states', context.component.states || []);
  }
  const axesConstants = [...axisConstants.entries()]
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([name, values]) => `const ${name} = ${JSON.stringify(values)};`)
    .join('\n');
  const layout = rendered.map((item, index) => ({ index, axes: item.axes, ...item.axes, x: item.x, y: item.y }));
  const defaultAxes = rendered[0]?.axes || {};
  const reservedProps = new Set(['axisValues', 'className', 'previewStyle', 'rootProps', 'figmaIndex']);
  const axisProps = Object.keys(defaultAxes)
    .filter((axis) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(axis) && !reservedProps.has(axis));
  const functionParameters = [
    ...axisProps.map((axis) => `${axis} = DEFAULT_AXES[${JSON.stringify(axis)}]`),
    ...((context.component.allowedProps || []).includes('className') ? ['className = ""'] : []),
    'axisValues = {}',
    'previewStyle',
  ].join(',\n  ');
  const activeAxes = axisProps
    .map((axis) => `${JSON.stringify(axis)}: ${axis}`)
    .join(', ');
  const classNameForward = (context.component.allowedProps || []).includes('className') ? 'className={className}' : '';
  const demoAxisProps = axisProps
    .map((axis) => `${axis}={item.axes[${JSON.stringify(axis)}]}`)
    .join('\n        ');

  return `const css = \`\n${state.css.join('\n')}\n\`;

${axesConstants}
const FIGMA_LAYOUT = ${JSON.stringify(layout, null, 2)};
const DEFAULT_AXES = ${JSON.stringify(defaultAxes)};

function ${layerName}({ figmaIndex = 0, previewStyle, className = "", rootProps = {} }) {
  switch (figmaIndex) {
${cases}
    default: return null;
  }
}

function ${componentName}({
  ${functionParameters}
} = {}) {
  const activeAxes = { ...DEFAULT_AXES, ...axisValues, ${activeAxes} };
  const selected = FIGMA_LAYOUT.find((item) => Object.entries(item.axes || {}).every(([axis, value]) => activeAxes[axis] === value)) || FIGMA_LAYOUT[0];
  return <${layerName} figmaIndex={selected.index} previewStyle={previewStyle} ${classNameForward} />;
}

const Demo = () => (
  <div className="${canvasClass}">
    <style>{css}</style>
    {FIGMA_LAYOUT.map((item) => (
      <${componentName}
        key={item.index}
        axisValues={item.axes}
        ${demoAxisProps}
        previewStyle={{ left: item.x, top: item.y }}
      />
    ))}
  </div>
);

render(<Demo />);`;
}

export function buildExactPreviewCode(context) {
  if (!context?.figma?.complete || !context?.figma?.blueprint) {
    throw new Error(`Blueprint Figma incomplet pour ${context?.component?.name || 'component'}`);
  }
  // Components with an explicit MCP contract use a semantic renderer. It keeps
  // the exact Figma canvas while exposing a useful developer API. All other
  // components use the generic MCP/Figma wrapper below.
  if (context.component.name === 'button') return buildButtonPreview(context);
  const assetPreview = buildFigmaAssetPreview(context);
  if (assetPreview) return assetPreview;
  const treePreview = buildGenericPreview(context);
  if (treePreview) return treePreview;

  // Compatibility fallback for cached contexts created before tree capture.
  if (context.component.name === 'spark') return buildSparkPreview(context);
  return null;
}

function keepReproducibleEffects(node, context) {
  if (!node || typeof node !== 'object') return node;
  const copy = { ...node };
  if (Array.isArray(node.effects)) {
    copy.effects = node.effects.filter((effect) => {
      if (!['DROP_SHADOW', 'INNER_SHADOW'].includes(effect?.type) || !effect?.css) return false;
      try {
        translateShadow(context, effect.css.replace(/^inset\s+/, ''));
        return true;
      } catch {
        return false;
      }
    });
  }
  if (Array.isArray(node.children)) {
    copy.children = node.children.map((child) => keepReproducibleEffects(child, context));
  }
  return copy;
}

function buildReviewPreviewCode(context) {
  const tree = context?.figma?.blueprint?.tree;
  if (!tree) return null;
  const reviewContext = {
    ...context,
    figma: {
      ...context.figma,
      blueprint: {
        ...context.figma.blueprint,
        tree: keepReproducibleEffects(tree, context),
      },
    },
  };
  return buildGenericPreview(reviewContext);
}

function approximationWarning(context, error = null) {
  const componentName = context?.component?.title || context?.component?.name || 'ce composant';
  const detail = error?.message || 'Le blueprint Figma ne peut pas etre transforme de facon deterministe.';

  return {
    code: 'figma_preview_approximate',
    title: 'Aperçu Figma à vérifier',
    message: `Le rendu de ${componentName} n'a pas pu être reproduit automatiquement à l'identique. Le workflow conserve le code généré pour revue manuelle.`,
    detail,
    suggestions: [
      "Comparer l'aperçu avec le composant dans Figma et identifier le calque ou effet concerné.",
      'Publier les couleurs, gradients ou assets nécessaires dans tokens.json puis régénérer variables.css.',
      "Ajouter un contrat @thiga-dev dans la description Figma si la structure HTML attendue doit être explicite.",
      "Corriger le code dans Live Editor, vérifier l'aperçu, puis valider et créer la PR.",
    ],
  };
}

export function enforceExactFigmaPreview(markdown, context) {
  const source = String(markdown || '');
  try {
    const code = buildExactPreviewCode(context);
    if (!code) {
      return {
        markdown: source,
        enforced: false,
        exact: false,
        warning: approximationWarning(context),
      };
    }
    return { markdown: replaceJsxBlock(source, code), enforced: true, exact: true, code, warning: null };
  } catch (error) {
    try {
      const code = buildReviewPreviewCode(context);
      if (code) {
        return {
          markdown: replaceJsxBlock(source, code),
          enforced: true,
          exact: false,
          code,
          warning: approximationWarning(context, error),
        };
      }
    } catch {
      // Keep the model output only when the Figma tree still cannot be rendered
      // after removing effects that have no canonical token representation.
    }
    return {
      markdown: source,
      enforced: false,
      exact: false,
      warning: approximationWarning(context, error),
    };
  }
}
