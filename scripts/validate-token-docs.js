import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDesignTokens } from './lib/token-normalizer.js';
import { loadRegistry, buildGenerationContext } from '../tools/ds-component-mcp/src/lib/registry.js';
import { validateComponentMarkdown } from '../tools/ds-component-mcp/src/lib/markdown.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = normalizeDesignTokens(JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8')));
const docs = JSON.parse(fs.readFileSync(path.join(root, 'tokens-docs.json'), 'utf8'));
const registry = loadRegistry(path.join(root, 'tools/ds-component-mcp/registry'));
const failures = [];
let validated = 0;
const requireCurrentDocs = process.env.REQUIRE_SSOT_V4 === '1';

if (requireCurrentDocs) {
  for (const name of Object.keys(registry)) {
    if (docs.component?.[name]?._meta?.workflowVersion !== 'ssot-v4') {
      failures.push(`${name}: documentation ssot-v4 manquante`);
    }
  }
}

for (const [name, entry] of Object.entries(docs.component || {})) {
  if (entry?._meta?.workflowVersion !== 'ssot-v4') continue;
  const context = buildGenerationContext(registry, tokens, name);
  if (!context) {
    failures.push(`${name}: composant absent du registre MCP`);
    continue;
  }
  const result = validateComponentMarkdown(entry.description, context);
  validated += 1;
  if (!result.valid) failures.push(`${name}: ${JSON.stringify(result.checks)}`);
}

if (failures.length) throw new Error(`Documentation invalide:\n${failures.join('\n')}`);
console.log(`Documentation ssot-v4 OK: ${validated} composant(s).`);
