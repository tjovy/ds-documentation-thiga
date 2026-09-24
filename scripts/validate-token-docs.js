import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDesignTokens } from './lib/token-normalizer.js';
import { loadRegistry, buildGenerationContext } from '../tools/ds-component-mcp/src/lib/registry.js';
import { loadFigmaCache } from '../tools/ds-component-mcp/src/lib/figma.js';
import { validateComponentMarkdown } from '../tools/ds-component-mcp/src/lib/markdown.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = normalizeDesignTokens(JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8')));
const docs = JSON.parse(fs.readFileSync(path.join(root, 'tokens-docs.json'), 'utf8'));
const registry = loadRegistry(path.join(root, 'tools/ds-component-mcp/registry'));
const figmaCache = loadFigmaCache(path.join(root, 'n8n', 'cache', 'figma-design-specs.json'));
const failures = [];
let validated = 0;
const requireCurrentDocs = process.env.REQUIRE_SSOT_V4 === '1';
const currentWorkflowVersion = 'ssot-v8';

if (requireCurrentDocs) {
  const entries = Object.entries(docs.component || {});
  if (!entries.length) failures.push('aucune documentation de composant presente');
  for (const [name, entry] of entries) {
    if (entry?._meta?.workflowVersion !== currentWorkflowVersion) {
      failures.push(`${name}: documentation ${currentWorkflowVersion} manquante`);
    }
  }
}

for (const [name, entry] of Object.entries(docs.component || {})) {
  if (entry?._meta?.workflowVersion !== currentWorkflowVersion) continue;
  const context = buildGenerationContext(registry, tokens, name, figmaCache);
  if (!context) {
    failures.push(`${name}: composant absent du registre MCP`);
    continue;
  }
  const result = validateComponentMarkdown(entry.description, context, {
    allowVisualApproximation: Boolean(entry?._meta?.preview?.warning),
  });
  validated += 1;
  if (!result.valid) failures.push(`${name}: ${JSON.stringify(result.checks)}`);
  if (entry?._meta?.accessibility?.spec?.source !== context.component.accessibilitySpec.source) {
    failures.push(`${name}: provenance du contrat accessibilite absente ou obsolete`);
  }
  if (!entry?._meta?.accessibility?.audit?.staticChecks) {
    failures.push(`${name}: audit statique accessibilite absent`);
  }
  if (entry?._meta?.accessibility?.reviewStatus !== 'review-required' && entry?._meta?.accessibility?.reviewStatus !== 'reviewed-in-code') {
    failures.push(`${name}: statut de revue accessibilite absent`);
  }
}

if (failures.length) throw new Error(`Documentation invalide:\n${failures.join('\n')}`);
console.log(`Documentation ${currentWorkflowVersion} OK: ${validated} composant(s).`);
