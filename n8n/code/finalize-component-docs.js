const WORKFLOW_VERSION = 'ssot-v7';
const RENDERER_VERSION = 'figma-tree-v5';
const MCP_ENDPOINT = 'http://127.0.0.1:3101/mcp';
// The done output of Loop Over Items contains the generated result of every iteration.
const generatedItems = $input.all();
const sourceItems = $('Filtrer les composants incomplets').all();
const contextItems = $('Get component generation context').all();

function formatBranchTimestamp() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}-${parts.second}-${Date.now().toString(36).slice(-5)}`;
}

function parseSseJson(raw) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLine = lines.find((line) => line.startsWith('data: '));
  if (!dataLine) {
    throw new Error('Reponse MCP invalide: data manquante');
  }
  return JSON.parse(dataLine.slice(6));
}

function getModelText(payload) {
  if (!payload) return '';
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.content === 'string') return payload.content;
  if (Array.isArray(payload.content)) {
    const textBlock = payload.content.find((block) => block?.type === 'text' && typeof block.text === 'string');
    if (textBlock) return textBlock.text;
  }
  if (typeof payload.output === 'string') return payload.output;
  if (Array.isArray(payload.output)) {
    const message = payload.output.find((item) => item?.type === 'message' && Array.isArray(item.content));
    const textBlock = message?.content?.find((block) => typeof block?.text === 'string');
    if (textBlock) return textBlock.text;
  }
  if (payload.message?.content) {
    if (typeof payload.message.content === 'string') return payload.message.content;
    if (Array.isArray(payload.message.content)) {
      const textBlock = payload.message.content.find((block) => block?.type === 'text' && typeof block.text === 'string');
      if (textBlock) return textBlock.text;
    }
  }
  return '';
}

function sanitizeMarkdown(markdown) {
  const text = String(markdown || '').trim();
  if (!text) return '';

  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) {
    return `${text}\n\`\`\`\n`;
  }

  return text;
}

async function callMcpTool(name, args) {
  const raw = await this.helpers.httpRequest({
    method: 'POST',
    url: MCP_ENDPOINT,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }),
    returnFullResponse: false,
  });

  const payload = parseSseJson(raw);
  return payload.result?.structuredContent || null;
}

function toContextPayload(raw) {
  return raw?.json?.mcpContext ?? raw?.json?.structuredContent ?? raw?.json?.content ?? raw?.json ?? {};
}

const previousDocs = JSON.parse(JSON.stringify(sourceItems[0]?.json?.previousDocs || {}));
if (!previousDocs.component) {
  previousDocs.component = {};
}

const expectedComponents = sourceItems
  .map((item) => item?.json?.componentName)
  .filter(Boolean);
const generatedByComponent = new Map(
  generatedItems
    .map((item) => item?.json || {})
    .filter((item) => item.componentName)
    .map((item) => [item.componentName, item]),
);
const contextByComponent = new Map(
  contextItems
    .map((item) => item?.json || {})
    .filter((item) => item.componentName)
    .map((item) => [item.componentName, item]),
);
const validComponents = [];
const invalidComponents = [];

for (const source of sourceItems) {
  const sourceItem = source?.json || {};
  const componentName = sourceItem.componentName || null;
  const generated = componentName ? generatedByComponent.get(componentName) : null;
  const markdown = sanitizeMarkdown(getModelText(generated));
  const context = toContextPayload(componentName ? contextByComponent.get(componentName) : null);
  const comparison = sourceItem.sourceComparison || {};
  const referencedTokenPaths = comparison.referencedTokenPaths || [];
  const componentTokenHash = comparison.componentTokenHash;
  const referencedTokenHash = comparison.referencedTokenHash;
  const figmaHash = comparison.figmaHash;
  const sourceHash = comparison.currentSourceHash;

  if (!componentName || !markdown) {
    invalidComponents.push({
      componentName: componentName || 'unknown',
      reason: 'empty_markdown',
    });
    continue;
  }

  const validation = await callMcpTool.call(this, 'validate_component_markdown', {
    name: componentName,
    markdown,
    tokens: sourceItem.sourceTokens,
    sourceRef: sourceItem.sourceRef,
    allowVisualApproximation: Boolean(generated?.preview?.warning),
  });

  if (!validation?.valid) {
    invalidComponents.push({
      componentName,
      reason: 'mcp_validation_failed',
      checks: validation?.checks || null,
      markdownPreview: markdown.slice(0, 800),
    });
    continue;
  }

  if (!previousDocs.component[componentName]) {
    previousDocs.component[componentName] = {};
  }

  previousDocs.component[componentName].description = markdown;
  previousDocs.component[componentName]._meta = {
    workflowVersion: WORKFLOW_VERSION,
    rendererVersion: comparison.rendererVersion || RENDERER_VERSION,
    generatedAt: new Date().toISOString(),
    sourceHash,
    componentTokenHash,
    referencedTokenHash,
    figmaHash,
    referencedTokenPaths,
    figmaMatchedKey: context.figma?.matchedKey || null,
    figmaCachedAt: context.figma?.cachedAt || null,
    variableCssSource: 'main:build/css/variables.css',
    notes: sourceItem.sourceComparison?.reasons || [],
    preview: {
      exact: generated?.preview?.exact === true,
      enforced: generated?.preview?.enforced === true,
      warning: generated?.preview?.warning || null,
    },
    accessibility: {
      spec: context.component?.accessibilitySpec || null,
      audit: validation.checks?.accessibility || null,
      reviewStatus: validation.checks?.accessibility?.reviewRequired ? 'review-required' : 'reviewed-in-code',
    },
  };

  validComponents.push(componentName);
}

const missingComponents = expectedComponents.filter((name) => !validComponents.includes(name));

if (invalidComponents.length || missingComponents.length) {
  throw new Error(
    `Validation bloquante: missing=${JSON.stringify(missingComponents)} invalid=${JSON.stringify(invalidComponents)}`,
  );
}

if (!validComponents.length) throw new Error('Aucun composant valide genere. Aucun push GitHub.');

const branchName = `ai/tokens-update-${formatBranchTimestamp()}`;
const previewWarnings = validComponents
  .map((componentName) => ({ componentName, warning: previousDocs.component[componentName]?._meta?.preview?.warning || null }))
  .filter((entry) => entry.warning);
const accessibilityReviews = validComponents
  .filter((componentName) => previousDocs.component[componentName]?._meta?.accessibility?.reviewStatus === 'review-required');

return [
  {
    json: {
      mode: 'production',
      message: previewWarnings.length || accessibilityReviews.length
        ? 'Validation MCP OK. Revue visuelle et accessibilite a completer dans Storybook avant la PR.'
        : 'Validation MCP OK. Branche GitHub prete pour review Storybook.',
      updatedComponents: validComponents.length,
      validComponents,
      invalidComponents,
      previewWarnings,
      accessibilityReviews,
      content: JSON.stringify(previousDocs, null, 2),
      contentBase64: Buffer.from(JSON.stringify(previousDocs, null, 2), 'utf-8').toString('base64'),
      owner: 'tjovy',
      repo: 'ds-documentation-thiga',
      filePath: 'tokens-docs.json',
      baseBranch: 'main',
      baseSha: sourceItems[0]?.json?.sourceRef || null,
      branchName,
      commitMessage: `docs(tokens): refresh ${validComponents.join(', ')}`,
    },
  },
];
