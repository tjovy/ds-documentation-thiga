/**
 * Export native Figma variables to a token JSON file.
 *
 * This intentionally bypasses Tokens Studio. It reads Figma's Variables REST API
 * and converts local variables into the token shape used by this Storybook.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const defaultFileKey = 'eJDPjIrF5PRUpMXtXsvSRX';
const defaultOutput = path.join(rootDir, 'tokens.figma-export.json');
const envPath = path.join(rootDir, '.env.local');

const collectionNameMap = {
  primitive: 'core',
  primitives: 'core',
  core: 'core',
  semantic: 'semantic',
  component: 'component',
  components: 'component',
  typography: 'typography',
  dimensions: 'core',
  'semantic color': 'semantic',
};

function parseArgs(argv) {
  const args = {
    fileKey: process.env.FIGMA_FILE_KEY || defaultFileKey,
    output: process.env.FIGMA_TOKENS_OUTPUT || defaultOutput,
    raw: false,
    help: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') args.help = true;
    else if (value === '--raw') args.raw = true;
    else if (value === '--file-key') args.fileKey = argv[++index];
    else if (value.startsWith('--file-key=')) args.fileKey = value.slice('--file-key='.length);
    else if (value === '--out') args.output = path.resolve(rootDir, argv[++index]);
    else if (value.startsWith('--out=')) args.output = path.resolve(rootDir, value.slice('--out='.length));
    else throw new Error(`Option inconnue: ${value}`);
  }

  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function printHelp() {
  console.log(`
Usage:
  node scripts/export-figma-variables.js [options]

Options:
  --file-key <key>   Figma file key. Defaults to demo-thiga (${defaultFileKey}).
  --out <path>       Output path. Defaults to tokens.figma-export.json.
  --raw              Write the raw Figma API response instead of converted tokens.
  --help             Show this help.

Required environment:
  FIGMA_TOKEN        Figma personal access token or OAuth token with file_variables:read.

Examples:
  node scripts/export-figma-variables.js
  node scripts/export-figma-variables.js --out tokens.json
  FIGMA_TOKEN=figd_xxx node scripts/export-figma-variables.js --out tokens.json
`);
}

function normalizeCollectionName(name = '') {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^\d+\s*[·._-]\s*/, '')
    .replace(/\/.*$/, '')
    .trim();
  return collectionNameMap[normalized] || normalized || 'tokens';
}

function splitTokenName(name = '') {
  return name
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function setDeep(root, keys, value) {
  let current = root;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }

    current[key] ||= {};
    current = current[key];
  });
}

function roundChannel(channel) {
  return Math.max(0, Math.min(255, Math.round(Number(channel || 0) * 255)));
}

function toHexPart(value) {
  return value.toString(16).padStart(2, '0');
}

function formatColor(value) {
  const r = roundChannel(value.r);
  const g = roundChannel(value.g);
  const b = roundChannel(value.b);
  const alpha = value.a === undefined ? 1 : Number(value.a);

  if (alpha === 0) return 'rgba(0, 0, 0, 0)';
  if (alpha > 0 && alpha < 1) return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;

  return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
}

function isVariableAlias(value) {
  return value && typeof value === 'object' && value.type === 'VARIABLE_ALIAS' && value.id;
}

function inferTokenType(variable) {
  if (variable.resolvedType === 'COLOR') return 'color';
  if (variable.resolvedType === 'STRING') return 'string';
  if (variable.resolvedType === 'BOOLEAN') return 'boolean';

  const name = variable.name.toLowerCase();
  if (name.includes('radius')) return 'borderRadius';
  if (name.includes('opacity')) return 'opacity';
  if (name.includes('fontsize') || name.includes('font-size')) return 'fontSizes';
  if (name.includes('fontweight') || name.includes('font-weight')) return 'fontWeights';
  if (name.includes('lineheight') || name.includes('line-height')) return 'lineHeights';
  if (name.includes('letterspacing') || name.includes('letter-spacing')) return 'letterSpacing';
  if (name.includes('spacing') || name.includes('padding') || name.includes('gap')) return 'spacing';
  if (name.includes('width') || name.includes('height') || name.includes('size')) return 'sizing';
  return 'number';
}

function cssUnitFor(variable) {
  const name = variable.name.toLowerCase();
  const type = inferTokenType(variable);

  if (type === 'fontWeights' || type === 'opacity' || type === 'number') return '';
  if (name.includes('lineheight') || name.includes('line-height')) return '';
  return 'px';
}

function formatNumber(value, variable) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const unit = cssUnitFor(variable);
  return unit ? `${number}${unit}` : number;
}

function pathForVariable(variable, collectionsById) {
  const collection = collectionsById[variable.variableCollectionId];
  const group = normalizeCollectionName(collection?.name);
  return {
    group,
    keys: splitTokenName(variable.name),
  };
}

function aliasReference(value, variablesById, collectionsById) {
  const target = variablesById[value.id];
  if (!target) return `{${value.id}}`;

  const { keys } = pathForVariable(target, collectionsById);
  return `{${keys.join('.')}}`;
}

function convertValue(value, variable, variablesById, collectionsById) {
  if (isVariableAlias(value)) return aliasReference(value, variablesById, collectionsById);
  if (variable.resolvedType === 'COLOR' && value && typeof value === 'object') return formatColor(value);
  if (variable.resolvedType === 'FLOAT') return formatNumber(value, variable);
  return value;
}

function convertFigmaVariables(payload, fileKey) {
  const variablesById = payload.meta?.variables || {};
  const collectionsById = payload.meta?.variableCollections || {};
  const output = {
    $metadata: {
      source: 'figma-variables-rest-api',
      fileKey,
      exportedAt: new Date().toISOString(),
    },
  };

  const variableEntries = Object.values(variablesById)
    .filter((variable) => variable && !variable.remote)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const variable of variableEntries) {
    const collection = collectionsById[variable.variableCollectionId];
    if (!collection) continue;

    const { group, keys } = pathForVariable(variable, collectionsById);
    if (!keys.length) continue;

    const defaultModeId = collection.defaultModeId || collection.modes?.[0]?.modeId;
    const modeValues = {};

    for (const mode of collection.modes || []) {
      const rawModeValue = variable.valuesByMode?.[mode.modeId];
      if (rawModeValue !== undefined) {
        modeValues[mode.name] = convertValue(rawModeValue, variable, variablesById, collectionsById);
      }
    }

    const rawDefaultValue = variable.valuesByMode?.[defaultModeId] ?? Object.values(variable.valuesByMode || {})[0];
    const token = {
      value: convertValue(rawDefaultValue, variable, variablesById, collectionsById),
      type: inferTokenType(variable),
    };

    if (variable.description) token.description = variable.description;
    if (Object.keys(modeValues).length > 1) {
      token.$extensions = {
        figma: {
          id: variable.id,
          key: variable.key,
          collection: collection.name,
          modes: modeValues,
        },
      };
    }

    output[group] ||= {};
    setDeep(output[group], keys, token);
  }

  return output;
}

async function fetchLocalVariables(fileKey, token) {
  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403 && body.includes('file_variables:read')) {
      throw new Error(
        'Le token Figma est valide, mais il n’a pas le scope file_variables:read. Cree un nouveau Personal Access Token Figma avec ce scope, puis remplace FIGMA_TOKEN dans .env.local.'
      );
    }
    throw new Error(`Figma API ${response.status}: ${body}`);
  }

  return response.json();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

loadEnvFile(envPath);

const args = parseArgs(process.argv);
if (args.help) {
  printHelp();
  process.exit(0);
}

const figmaToken = process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN;
if (!figmaToken) {
  console.error('FIGMA_TOKEN est manquant. Ajoute-le dans .env.local ou passe-le devant la commande.');
  console.error('Exemple: FIGMA_TOKEN=figd_xxx node scripts/export-figma-variables.js');
  process.exit(1);
}

console.log(`Export des variables Figma depuis ${args.fileKey}...`);

try {
  const payload = await fetchLocalVariables(args.fileKey, figmaToken);
  const output = args.raw ? payload : convertFigmaVariables(payload, args.fileKey);
  writeJson(args.output, output);

  const variables = Object.keys(payload.meta?.variables || {}).length;
  const collections = Object.keys(payload.meta?.variableCollections || {}).length;

  console.log(`OK: ${variables} variables, ${collections} collections.`);
  console.log(`Fichier ecrit: ${path.relative(rootDir, args.output)}`);
} catch (error) {
  console.error(`Export impossible: ${error.message}`);
  process.exit(1);
}
