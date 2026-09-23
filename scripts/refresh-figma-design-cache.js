/**
 * Refresh the compact Figma design-spec cache used by the MCP server.
 *
 * The script discovers every local Figma component set and standalone
 * component. Component variants that belong to a set are represented by their
 * parent set, so a newly-created Figma component is visible to the workflow
 * without first adding an entry to tokens.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');
const defaultFileKey = 'eJDPjIrF5PRUpMXtXsvSRX';
const defaultTokensPath = path.join(rootDir, 'tokens.json');
const defaultCachePath = path.join(rootDir, 'n8n', 'cache', 'figma-design-specs.json');

function parseArgs(argv) {
  const args = {
    fileKey: process.env.THIGA_FIGMA_FILE_KEY || defaultFileKey,
    tokensPath: process.env.DS_TOKENS_PATH || defaultTokensPath,
    output: process.env.DS_FIGMA_CACHE_PATH || defaultCachePath,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--file-key') args.fileKey = argv[++index];
    else if (value.startsWith('--file-key=')) args.fileKey = value.slice('--file-key='.length);
    else if (value === '--tokens') args.tokensPath = path.resolve(rootDir, argv[++index]);
    else if (value.startsWith('--tokens=')) args.tokensPath = path.resolve(rootDir, value.slice('--tokens='.length));
    else if (value === '--out') args.output = path.resolve(rootDir, argv[++index]);
    else if (value.startsWith('--out=')) args.output = path.resolve(rootDir, value.slice('--out='.length));
    else throw new Error(`Option inconnue: ${value}`);
  }

  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function figmaGet(fileKey, endpoint, token) {
  const suffix = endpoint ? `/${endpoint}` : '';
  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}${suffix}`, {
    headers: { 'X-Figma-Token': token },
  });

  if (!response.ok) {
    throw new Error(`Figma API ${response.status} ${endpoint}: ${await response.text()}`);
  }

  return response.json();
}

function toList(payload, key) {
  return payload?.meta?.[key] || payload?.[key] || [];
}

function discoverNodeIds(componentSetsPayload, componentsPayload) {
  const seen = new Set();
  const items = [];

  const add = (item, kind) => {
    const name = item?.name || '';
    const nodeId = item?.node_id || item?.nodeId;
    if (!nodeId || seen.has(nodeId)) return;
    seen.add(nodeId);
    items.push({ nodeId, name, kind });
  };

  for (const item of toList(componentSetsPayload, 'component_sets')) {
    add(item, 'component_set');
  }

  for (const item of toList(componentsPayload, 'components')) {
    if (item.component_set_id || item.componentSetId) continue;
    add(item, 'component');
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function discoverNodeIdsFromDocument(documentPayload) {
  const seen = new Set();
  const items = [];

  function visit(node, trail = [], insideComponentSet = false) {
    if (!node || typeof node !== 'object') return;

    const nextTrail = node.name ? [...trail, node.name] : trail;
    const isComponentSet = node.type === 'COMPONENT_SET';
    const isStandaloneComponent = node.type === 'COMPONENT' && !insideComponentSet;
    if (isComponentSet || isStandaloneComponent) {
      const nodeId = node.id;
      if (nodeId && !seen.has(nodeId)) {
        seen.add(nodeId);
        items.push({
          nodeId,
          name: node.name,
          kind: node.type.toLowerCase(),
          path: nextTrail.join(' / '),
        });
      }
    }

    for (const child of node.children || []) {
      visit(child, nextTrail, insideComponentSet || isComponentSet);
    }
  }

  visit(documentPayload?.document);
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function rgbaToCSS(color) {
  if (!color) return null;
  const r = Math.round((color.r || 0) * 255);
  const g = Math.round((color.g || 0) * 255);
  const b = Math.round((color.b || 0) * 255);
  const a = color.a !== undefined ? color.a : 1;
  return a < 1
    ? `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
    : `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function extractFills(fills) {
  if (!Array.isArray(fills)) return [];
  return fills.filter((fill) => fill.visible !== false).map((fill) => ({
    type: fill.type,
    color: fill.type === 'SOLID' ? rgbaToCSS(fill.color) : null,
    opacity: fill.opacity,
  }));
}

function extractEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects.filter((effect) => effect.visible !== false).map((effect) => {
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
      return {
        type: effect.type,
        css: `${inset}${effect.offset?.x || 0}px ${effect.offset?.y || 0}px ${effect.radius || 0}px ${effect.spread || 0}px ${rgbaToCSS(effect.color)}`,
      };
    }
    return { type: effect.type };
  });
}

function extractTextStyle(node) {
  if (node.type !== 'TEXT' || !node.style) return null;
  const style = node.style;
  return {
    fontFamily: style.fontFamily || null,
    fontSize: style.fontSize ? `${style.fontSize}px` : null,
    fontWeight: style.fontWeight || null,
    lineHeight: style.lineHeightPx ? `${Math.round(style.lineHeightPx)}px` : null,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : null,
    textAlign: style.textAlignHorizontal?.toLowerCase() || null,
  };
}

function extractAutoLayout(node) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null;
  return {
    direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    gap: node.itemSpacing != null ? `${node.itemSpacing}px` : null,
    paddingTop: node.paddingTop != null ? `${node.paddingTop}px` : null,
    paddingRight: node.paddingRight != null ? `${node.paddingRight}px` : null,
    paddingBottom: node.paddingBottom != null ? `${node.paddingBottom}px` : null,
    paddingLeft: node.paddingLeft != null ? `${node.paddingLeft}px` : null,
    alignItems: node.counterAxisAlignItems === 'CENTER' ? 'center' : node.counterAxisAlignItems === 'MAX' ? 'flex-end' : 'flex-start',
    justifyContent: node.primaryAxisAlignItems === 'CENTER' ? 'center' : node.primaryAxisAlignItems === 'SPACE_BETWEEN' ? 'space-between' : 'flex-start',
  };
}

function extractDesignSpec(node, parentBox = null) {
  const box = node.absoluteBoundingBox || null;
  const spec = {
    id: node.id || null,
    name: node.name,
    type: node.type,
    description: node.description || null,
    x: box && parentBox ? `${Math.round(box.x - parentBox.x)}px` : null,
    y: box && parentBox ? `${Math.round(box.y - parentBox.y)}px` : null,
    width: box?.width ? `${Math.round(box.width)}px` : null,
    height: box?.height ? `${Math.round(box.height)}px` : null,
    visible: node.visible !== false,
    characters: node.type === 'TEXT' ? node.characters || '' : null,
    cornerRadius: node.cornerRadius != null ? `${node.cornerRadius}px` : null,
    cornerRadii: node.rectangleCornerRadii || null,
    fills: extractFills(node.fills),
    strokes: Array.isArray(node.strokes)
      ? node.strokes.filter((stroke) => stroke.visible !== false).map((stroke) => ({
        color: rgbaToCSS(stroke.color),
        weight: node.strokeWeight ? `${node.strokeWeight}px` : null,
        align: node.strokeAlign,
      }))
      : [],
    effects: extractEffects(node.effects),
    autoLayout: extractAutoLayout(node),
    textStyle: extractTextStyle(node),
    opacity: node.opacity != null && node.opacity < 1 ? node.opacity : null,
    clipsContent: node.clipsContent ?? false,
  };

  if (Array.isArray(node.children) && node.children.length > 0) {
    spec.children = node.children.map((child) => extractDesignSpec(child, box || parentBox));
  }

  return spec;
}

loadEnvFile(envPath);

const args = parseArgs(process.argv);
const figmaToken = process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN;
if (!figmaToken) {
  console.error('FIGMA_TOKEN est manquant. Ajoute-le dans .env.local ou dans l’environnement n8n.');
  process.exit(1);
}

try {
  const [componentSetsPayload, componentsPayload] = await Promise.all([
    figmaGet(args.fileKey, 'component_sets', figmaToken),
    figmaGet(args.fileKey, 'components', figmaToken),
  ]);

  let discovered = discoverNodeIds(componentSetsPayload, componentsPayload);
  let discoverySource = 'component_sets + components';
  if (!discovered.length) {
    const documentPayload = await figmaGet(args.fileKey, '', figmaToken);
    discovered = discoverNodeIdsFromDocument(documentPayload);
    discoverySource = 'full file traversal';
  }

  if (!discovered.length) {
    throw new Error('Aucun component set ou composant autonome trouve dans le fichier Figma.');
  }

  const ids = discovered.map((item) => item.nodeId).join(',');
  const nodesPayload = await figmaGet(args.fileKey, `nodes?ids=${encodeURIComponent(ids)}`, figmaToken);
  const designSpecs = {};

  for (const nodeData of Object.values(nodesPayload.nodes || {})) {
    const doc = nodeData?.document || nodeData;
    if (doc?.name) {
      designSpecs[doc.name] = extractDesignSpec(doc);
    }
  }

  const cache = {
    _meta: {
      cached_at: new Date().toISOString(),
      figma_file_key: args.fileKey,
      source: `Figma REST API auto-discovery: ${discoverySource} + nodes`,
      node_ids: ids,
      discovered_components: discovered,
    },
    figma_design_specs: designSpecs,
    specs_count: Object.keys(designSpecs).length,
  };

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');

  console.log(`OK: ${discovered.length} composants Figma detectes.`);
  console.log(`Fichier ecrit: ${path.relative(rootDir, args.output)}`);
  console.log(discovered.map((item) => `- ${item.name} (${item.kind})`).join('\n'));
} catch (error) {
  console.error(`Refresh cache Figma impossible: ${error.message}`);
  process.exit(1);
}
