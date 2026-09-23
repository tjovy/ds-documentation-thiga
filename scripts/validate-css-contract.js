import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDesignTokens } from './lib/token-normalizer.js';
import { loadRegistry, buildGenerationContext } from '../tools/ds-component-mcp/src/lib/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = normalizeDesignTokens(JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8')));
const css = fs.readFileSync(path.join(root, 'build/css/variables.css'), 'utf8');
const registry = loadRegistry(path.join(root, 'tools/ds-component-mcp/registry'));
const generatedVars = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((match) => match[1]));
const missing = [];

for (const componentName of Object.keys(registry)) {
  const context = buildGenerationContext(registry, tokens, componentName);
  for (const cssVar of context.contract.allowedCssVars) {
    if (!generatedVars.has(cssVar)) missing.push(`${componentName}: ${cssVar}`);
  }
}

if (missing.length) {
  throw new Error(`Variables autorisees absentes de variables.css:\n${missing.join('\n')}`);
}
console.log(`CSS contract OK: ${generatedVars.size} variables generees.`);
