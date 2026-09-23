import fs from 'fs';
import path from 'path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadRegistry, listComponentSummaries, buildGenerationContext } from './lib/registry.js';
import { loadJson, buildKnownCssVars } from './lib/tokens.js';
import { validateComponentMarkdown } from './lib/markdown.js';
import { enforceExactFigmaPreview } from './lib/exact-preview.js';
import { loadFigmaCache } from './lib/figma.js';
import { normalizeDesignTokens } from '../../../scripts/lib/token-normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const registryDir = path.join(packageRoot, 'registry');
const defaultRawTokensPath = path.join(repoRoot, 'tokens.json');
const tokensPath = process.env.DS_TOKENS_PATH || defaultRawTokensPath;
const figmaCachePath =
  process.env.DS_FIGMA_CACHE_PATH || path.join(repoRoot, 'n8n', 'cache', 'figma-design-specs.json');
const refreshFigmaScript = path.join(repoRoot, 'scripts', 'refresh-figma-design-cache.js');
const execFileAsync = promisify(execFile);

const registry = loadRegistry(registryDir);

function loadRuntimeState(tokensOverride = null) {
  const rawTokens = tokensOverride && typeof tokensOverride === 'object'
    ? tokensOverride
    : loadJson(tokensPath);
  const tokens = normalizeDesignTokens(rawTokens);
  return {
    tokens,
    figmaCache: loadFigmaCache(figmaCachePath),
    knownCssVars: buildKnownCssVars(tokens),
  };
}

export function createMcpServer() {
const server = new McpServer({
  name: 'ds-component-mcp',
  version: '0.1.0',
});

server.tool(
  'refresh_figma_context',
  'Refresh the exhaustive local Figma component cache before discovery.',
  {},
  async () => {
    const { stdout } = await execFileAsync(process.execPath, [refreshFigmaScript, '--out', figmaCachePath], {
      cwd: repoRoot,
      env: process.env,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const figmaCache = loadFigmaCache(figmaCachePath);
    const payload = {
      refreshed: true,
      cachedAt: figmaCache?._meta?.cached_at || null,
      components: figmaCache?._meta?.discovered_components || [],
      specsCount: figmaCache?.specs_count || 0,
      log: stdout.trim(),
    };
    return {
      structuredContent: payload,
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  },
);

server.tool(
  'list_components',
  'List all documentable design-system components.',
  {
    tokens: z.record(z.unknown()).optional().describe('Exact tokens.json snapshot read by the caller.'),
  },
  async ({ tokens: tokensOverride }) => {
    const { tokens, figmaCache } = loadRuntimeState(tokensOverride);
    const payload = {
      components: listComponentSummaries(registry, tokens, figmaCache),
      figma: {
        cachePath: figmaCachePath,
        cachedAt: figmaCache?._meta?.cached_at || null,
        source: figmaCache?._meta?.source || null,
      },
    };
    return {
      structuredContent: payload,
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'get_component_definition',
  'Return the semantic contract for one component.',
  {
    name: z.string().describe('Component name, for example button or input.'),
  },
  async ({ name }) => {
    const { tokens, figmaCache } = loadRuntimeState();
    const context = buildGenerationContext(registry, tokens, name, figmaCache);
    if (!context) {
      const errorPayload = { error: `Unknown component: ${name}` };
      return {
        structuredContent: errorPayload,
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorPayload, null, 2),
          },
        ],
      };
    }

    const payload = { component: context.component };
    return {
      structuredContent: payload,
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'get_component_generation_context',
  'Return the full generation context that the documentation generator must follow for one component.',
  {
    name: z.string().describe('Component name, for example button or input.'),
    tokens: z.record(z.unknown()).optional().describe('Exact tokens.json snapshot read by the caller.'),
    sourceRef: z.string().optional().describe('Git commit or ref associated with the token snapshot.'),
  },
  async ({ name, tokens: tokensOverride, sourceRef }) => {
    const { tokens, figmaCache, knownCssVars } = loadRuntimeState(tokensOverride);
    const context = buildGenerationContext(registry, tokens, name, figmaCache);
    if (!context) {
      const errorPayload = { error: `Unknown component: ${name}` };
      return {
        structuredContent: errorPayload,
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorPayload, null, 2),
          },
        ],
      };
    }

    const payload = {
      ...context,
      repositoryContext: {
        tokenSource: tokensOverride ? 'caller-snapshot' : 'local-file',
        tokensPath: tokensOverride ? null : tokensPath,
        sourceRef: sourceRef || null,
        figmaCachePath,
        knownCssVarCount: knownCssVars.length,
      },
    };

    return {
      structuredContent: payload,
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'enforce_exact_figma_preview',
  'Replace the generated live JSX with a deterministic Figma preview when possible, otherwise return a non-blocking review warning.',
  {
    name: z.string().describe('Component name, for example button or card.'),
    markdown: z.string().describe('Generated Markdown whose JSX preview must be normalized.'),
    tokens: z.record(z.unknown()).optional().describe('Exact tokens.json snapshot used for generation.'),
    sourceRef: z.string().optional().describe('Git commit or ref associated with the token snapshot.'),
  },
  async ({ name, markdown, tokens: tokensOverride }) => {
    const { tokens, figmaCache } = loadRuntimeState(tokensOverride);
    const context = buildGenerationContext(registry, tokens, name, figmaCache);
    if (!context) {
      const errorPayload = { error: `Unknown component: ${name}` };
      return {
        structuredContent: errorPayload,
        content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
      };
    }
    const payload = { name, ...enforceExactFigmaPreview(markdown, context) };
    return {
      structuredContent: payload,
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  },
);

server.tool(
  'validate_component_markdown',
  'Validate generated Markdown against the component contract and allowed CSS variables.',
  {
    name: z.string().describe('Component name, for example button or input.'),
    markdown: z.string().describe('Generated Markdown returned by the model.'),
    tokens: z.record(z.unknown()).optional().describe('Exact tokens.json snapshot used for generation.'),
    sourceRef: z.string().optional().describe('Git commit or ref associated with the token snapshot.'),
    allowVisualApproximation: z.boolean().optional().describe('Allow only visual exactness checks to remain a review warning. Syntax and token validation stay blocking.'),
  },
  async ({ name, markdown, tokens: tokensOverride, allowVisualApproximation }) => {
    const { tokens, figmaCache } = loadRuntimeState(tokensOverride);
    const context = buildGenerationContext(registry, tokens, name, figmaCache);
    if (!context) {
      const errorPayload = { valid: false, name, error: `Unknown component: ${name}` };
      return {
        structuredContent: errorPayload,
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorPayload, null, 2),
          },
        ],
      };
    }

    const result = {
      name,
      ...validateComponentMarkdown(markdown, context, { allowVisualApproximation }),
    };
    return {
      structuredContent: result,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const transport = new StdioServerTransport();
  await createMcpServer().connect(transport);
}
