import fs from 'fs';

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeAxisName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function loadFigmaCache(cachePath) {
  if (!cachePath || !fs.existsSync(cachePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

export function findFigmaSpec(cache, component) {
  const specs = cache?.figma_design_specs;
  if (!specs || typeof specs !== 'object') {
    return null;
  }

  const candidates = [
    component?.title,
    component?.name,
    String(component?.title || '').split('/').pop(),
    String(component?.name || '').split('/').pop(),
  ]
    .filter(Boolean)
    .map((value) => String(value));

  for (const candidate of candidates) {
    if (specs[candidate]) {
      return { key: candidate, spec: specs[candidate] };
    }
  }

  const normalizedCandidates = new Set(candidates.map(normalizeName));
  for (const [key, spec] of Object.entries(specs)) {
    if (normalizedCandidates.has(normalizeName(key)) || normalizedCandidates.has(normalizeName(key.split('/').pop()))) {
      return { key, spec };
    }
  }

  return null;
}

export function findRelatedFigmaSpecs(cache, matchedKey) {
  const specs = cache?.figma_design_specs;
  if (!specs || typeof specs !== 'object' || !matchedKey) {
    return [];
  }

  return Object.entries(specs)
    .filter(([key]) => key !== matchedKey && (key.startsWith(`${matchedKey}/`) || key.startsWith(`${matchedKey} `)))
    .map(([key, spec]) => ({ key, spec }));
}

function extractTextNodes(spec, trail = [], acc = []) {
  if (!spec || typeof spec !== 'object') {
    return acc;
  }

  const nextTrail = spec.name ? [...trail, spec.name] : trail;
  if (spec.type === 'TEXT') {
    acc.push({
      path: nextTrail.join(' > '),
      name: spec.name || null,
      characters: spec.characters || '',
      x: spec.x || null,
      y: spec.y || null,
      fills: spec.fills || [],
      textStyle: spec.textStyle || null,
      width: spec.width || null,
      height: spec.height || null,
    });
  }

  for (const child of spec.children || []) {
    extractTextNodes(child, nextTrail, acc);
  }

  return acc;
}

function parseButtonVariantName(name) {
  const properties = Object.fromEntries(
    String(name || '').split(',').map((part) => part.trim().split('=').map((value) => value.trim().toLowerCase())),
  );
  if (!properties.size || !properties.state || !(properties.style || properties.type)) return null;

  const sizeAliases = { small: 'sm', medium: 'md', large: 'lg' };
  const rawSize = properties.size;
  return {
    size: sizeAliases[rawSize] || rawSize,
    state: properties.state,
    variant: properties.style || properties.type,
  };
}

function extractButtonBlueprint(spec) {
  if (!spec || typeof spec !== 'object') {
    return null;
  }

  const variants = {};
  const sizes = {};
  const availableStates = new Set();
  const availableVariants = new Set();
  const availableSizes = new Set();

  for (const child of spec.children || []) {
    const meta = parseButtonVariantName(child?.name);
    if (!meta) continue;

    const labelNode = (child.children || []).find((item) => item?.type === 'TEXT' && /label/i.test(item?.name || ''))
      || (child.children || []).find((item) => item?.type === 'TEXT')
      || null;
    const iconNodes = (child.children || []).filter((item) => item?.visible !== false && /icon/i.test(item?.name || ''));
    const icons = iconNodes.map((iconNode) => {
      const iconText = extractTextNodes(iconNode)[0] || null;
      return {
        width: iconNode.width || null,
        height: iconNode.height || null,
        glyph: iconText?.characters || '',
        textColor: iconText?.fills?.[0]?.color || null,
        fontFamily: iconText?.textStyle?.fontFamily || null,
        fontSize: iconText?.textStyle?.fontSize || null,
        fontWeight: iconText?.textStyle?.fontWeight || null,
        lineHeight: iconText?.textStyle?.lineHeight || null,
      };
    });
    const content = (child.children || []).flatMap((item) => {
      if (item === labelNode) return [{ type: 'label' }];
      const iconIndex = iconNodes.indexOf(item);
      return iconIndex === -1 ? [] : [{ type: 'icon', index: iconIndex }];
    });
    const entry = {
      x: child.x || null,
      y: child.y || null,
      width: child.width || null,
      height: child.height || null,
      radius: child.cornerRadius || null,
      background: child.fills?.[0]?.color || null,
      border: child.strokes?.[0]?.color || null,
      borderWidth: child.strokes?.[0]?.weight || null,
      opacity: child.opacity ?? null,
      padding: child.autoLayout
        ? {
            top: child.autoLayout.paddingTop || null,
            right: child.autoLayout.paddingRight || null,
            bottom: child.autoLayout.paddingBottom || null,
            left: child.autoLayout.paddingLeft || null,
            gap: child.autoLayout.gap || null,
            alignItems: child.autoLayout.alignItems || null,
            justifyContent: child.autoLayout.justifyContent || null,
          }
        : null,
      label: labelNode
        ? {
            text: labelNode.characters || '',
            textColor: labelNode.fills?.[0]?.color || null,
            fontFamily: labelNode.textStyle?.fontFamily || null,
            fontSize: labelNode.textStyle?.fontSize || null,
            fontWeight: labelNode.textStyle?.fontWeight || null,
            lineHeight: labelNode.textStyle?.lineHeight || null,
          }
        : null,
      icons: {
        main: icons[0] || null,
        items: icons,
        content,
      },
    };

    if (!variants[meta.variant]) {
      variants[meta.variant] = {};
    }
    if (!variants[meta.variant][meta.state]) {
      variants[meta.variant][meta.state] = {};
    }
    variants[meta.variant][meta.state][meta.size] = entry;

    if (!sizes[meta.size]) {
      sizes[meta.size] = {
        minWidth: entry.width,
        minHeight: entry.height,
        radius: entry.radius,
        padding: entry.padding,
        label: entry.label,
        icons: entry.icons,
      };
    }

    availableVariants.add(meta.variant);
    availableStates.add(meta.state);
    availableSizes.add(meta.size);
  }

  return {
    shell: {
      width: spec.width || null,
      height: spec.height || null,
      radius: spec.cornerRadius || null,
      background: spec.fills?.[0]?.color || null,
      border: spec.strokes?.[0]?.color || null,
      borderWidth: spec.strokes?.[0]?.weight || null,
      clipsContent: spec.clipsContent ?? false,
    },
    variants,
    sizes,
    availableVariants: [...availableVariants].sort(),
    availableSizes: [...availableSizes].sort(),
    availableStates: [...availableStates].sort(),
    variantCount: (spec.children || []).filter((child) => parseButtonVariantName(child?.name)).length,
  };
}

function extractCardBlueprint(spec, relatedSpecs = []) {
  if (!spec || typeof spec !== 'object') {
    return null;
  }

  const parseName = (name) => {
    const match = String(name || '').match(/Tone=(.*?),\s*Media=(.*?),\s*State=(.*)$/i);
    if (!match) return null;
    return { tone: match[1].trim().toLowerCase(), media: match[2].trim().toLowerCase(), state: match[3].trim().toLowerCase() };
  };
  const variants = (spec.children || []).map((child) => {
    const axes = parseName(child?.name);
    if (!axes) return null;
    const mediaNode = (child.children || []).find((item) => /^media$/i.test(item?.name || '')) || null;
    const contentNode = (child.children || []).find((item) => /^content$/i.test(item?.name || '')) || null;
    const accentNode = (mediaNode?.children || []).find((item) => /accent/i.test(item?.name || '')) || null;
    const titleNode = (contentNode?.children || []).find((item) => /title/i.test(item?.name || '')) || null;
    const descriptionNode = (contentNode?.children || []).find((item) => /description/i.test(item?.name || '')) || null;

    return {
      name: child.name || null,
      ...axes,
      x: child.x || null,
      y: child.y || null,
      width: child.width || null,
      height: child.height || null,
      cornerRadius: child.cornerRadius || null,
      background: child.fills?.[0]?.color || null,
      border: child.strokes?.[0]?.color || null,
      borderWidth: child.strokes?.[0]?.weight || null,
      shadow: child.effects?.[0]?.css || null,
      padding: child.autoLayout
        ? {
            top: child.autoLayout.paddingTop || null,
            right: child.autoLayout.paddingRight || null,
            bottom: child.autoLayout.paddingBottom || null,
            left: child.autoLayout.paddingLeft || null,
            gap: child.autoLayout.gap || null,
          }
        : null,
      mediaSpec: mediaNode
        ? {
            x: mediaNode.x || null,
            y: mediaNode.y || null,
            width: mediaNode.width || null,
            height: mediaNode.height || null,
            radius: mediaNode.cornerRadius || null,
            cornerRadii: mediaNode.cornerRadii || null,
            background: mediaNode.fills?.[0]?.color || null,
            accent: accentNode
              ? {
                  x: accentNode.x || null,
                  y: accentNode.y || null,
                  width: accentNode.width || null,
                  height: accentNode.height || null,
                  radius: accentNode.cornerRadius || null,
                  background: accentNode.fills?.[0]?.color || null,
                }
              : null,
          }
        : null,
      content: contentNode
        ? {
            x: contentNode.x || null,
            y: contentNode.y || null,
            width: contentNode.width || null,
            height: contentNode.height || null,
            gap: contentNode.autoLayout?.gap || null,
            title: titleNode ? {
              text: titleNode.characters || '',
              width: titleNode.width || null,
              height: titleNode.height || null,
              color: titleNode.fills?.[0]?.color || null,
              textStyle: titleNode.textStyle || null,
            } : null,
            description: descriptionNode ? {
              text: descriptionNode.characters || '',
              width: descriptionNode.width || null,
              height: descriptionNode.height || null,
              color: descriptionNode.fills?.[0]?.color || null,
              textStyle: descriptionNode.textStyle || null,
            } : null,
          }
        : null,
    };
  }).filter(Boolean);

  return {
    shell: {
      width: spec.width || null,
      height: spec.height || null,
      radius: spec.cornerRadius || null,
      background: spec.fills?.[0]?.color || null,
      border: spec.strokes?.[0]?.color || null,
      borderWidth: spec.strokes?.[0]?.weight || null,
    },
    variants,
    availableTones: [...new Set(variants.map((item) => item.tone))].sort(),
    availableMedia: [...new Set(variants.map((item) => item.media))].sort(),
    availableStates: [...new Set(variants.map((item) => item.state))].sort(),
    variantCount: variants.length,
  };
}

function parseVariantProperties(name) {
  const source = String(name || '').trim();
  if (!source.includes('=')) {
    return null;
  }

  const properties = {};
  for (const part of source.split(',')) {
    const [rawKey, ...rawValue] = part.split('=');
    const key = normalizeAxisName(rawKey);
    const value = normalizeAxisName(rawValue.join('='));
    if (key && value) {
      properties[key] = value;
    }
  }

  return Object.keys(properties).length ? properties : null;
}

function collectGenericAxes(variants) {
  const axes = {};
  for (const variant of variants) {
    for (const [axis, value] of Object.entries(variant.axes || {})) {
      axes[axis] ||= new Set();
      axes[axis].add(value);
    }
  }

  return Object.fromEntries(
    Object.entries(axes).map(([axis, values]) => [axis, [...values].sort()])
  );
}

function compactNodeTree(spec) {
  if (!spec || typeof spec !== 'object') return null;
  return {
    name: spec.name || null,
    type: spec.type || null,
    x: spec.x || null,
    y: spec.y || null,
    width: spec.width || null,
    height: spec.height || null,
    visible: spec.visible !== false,
    characters: spec.characters || null,
    cornerRadius: spec.cornerRadius || null,
    cornerRadii: spec.cornerRadii || null,
    fills: spec.fills || [],
    strokes: spec.strokes || [],
    effects: spec.effects || [],
    opacity: spec.opacity ?? null,
    clipsContent: spec.clipsContent ?? false,
    textStyle: spec.textStyle || null,
    fillGeometry: ['VECTOR', 'LINE', 'BOOLEAN_OPERATION', 'POLYGON', 'STAR'].includes(spec.type) ? spec.fillGeometry || [] : [],
    strokeGeometry: ['VECTOR', 'LINE', 'BOOLEAN_OPERATION', 'POLYGON', 'STAR'].includes(spec.type) ? spec.strokeGeometry || [] : [],
    children: (spec.children || []).map(compactNodeTree).filter(Boolean),
  };
}

function extractGenericBlueprint(spec) {
  if (!spec || typeof spec !== 'object') {
    return null;
  }

  const textNodes = extractTextNodes(spec).slice(0, 12);
  const variants = (spec.children || [])
    .map((child) => {
      const axes = parseVariantProperties(child?.name);
      return {
        name: child?.name || null,
        axes: axes || {},
        x: child?.x || null,
        y: child?.y || null,
        width: child?.width || null,
        height: child?.height || null,
        cornerRadius: child?.cornerRadius || null,
        fills: child?.fills || [],
        strokes: child?.strokes || [],
        effects: child?.effects || [],
        autoLayout: child?.autoLayout || null,
        textNodes: extractTextNodes(child).slice(0, 8),
      };
    })
    .filter((entry) => entry.name);

  return {
    shell: {
      name: spec.name || null,
      x: spec.x || null,
      y: spec.y || null,
      width: spec.width || null,
      height: spec.height || null,
      radius: spec.cornerRadius || null,
      autoLayout: spec.autoLayout || null,
      fills: spec.fills || [],
      strokes: spec.strokes || [],
      effects: spec.effects || [],
    },
    axes: collectGenericAxes(variants),
    variants,
    textNodes,
    tree: compactNodeTree(spec),
    variantCount: variants.length,
  };
}

export function extractDesignBlueprint(matchedKey, spec, relatedSpecs = []) {
  if (!matchedKey || !spec) {
    return null;
  }

  // The compact tree is the visual source of truth for every component. The
  // specialised summaries below only enrich the developer-facing contract.
  const generic = extractGenericBlueprint(spec);
  const withVisualTree = (blueprint) => ({
    ...blueprint,
    tree: generic.tree,
    genericAxes: generic.axes,
    genericVariants: generic.variants,
    genericTextNodes: generic.textNodes,
  });

  if (matchedKey === 'Button') {
    return withVisualTree(extractButtonBlueprint(spec));
  }

  return generic;
}

export function summarizeDesignSpec(spec, depth = 0, maxDepth = 4) {
  if (!spec || typeof spec !== 'object') {
    return null;
  }

  const summary = {
    name: spec.name || null,
    type: spec.type || null,
    x: spec.x || null,
    y: spec.y || null,
    width: spec.width || null,
    height: spec.height || null,
    cornerRadius: spec.cornerRadius || null,
    cornerRadii: spec.cornerRadii || null,
    fills: spec.fills || [],
    strokes: spec.strokes || [],
    effects: spec.effects || [],
    autoLayout: spec.autoLayout || null,
    textStyle: spec.textStyle || null,
    characters: spec.characters || null,
    opacity: spec.opacity ?? null,
    clipsContent: spec.clipsContent ?? false,
  };

  const children = Array.isArray(spec.children) ? spec.children : [];
  if (!children.length) {
    return summary;
  }

  summary.childCount = children.length;

  if (depth >= maxDepth) {
    summary.children = children.slice(0, 16).map((child) => ({
      name: child?.name || null,
      type: child?.type || null,
    }));
    return summary;
  }

  summary.children = children.slice(0, 24).map((child) => summarizeDesignSpec(child, depth + 1, maxDepth));
  return summary;
}
