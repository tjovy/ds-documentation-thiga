const MCP_ENDPOINT = 'http://127.0.0.1:3101/mcp';
const MCP_TOOL_NAME = 'get_component_generation_context';
const MAX_FIGMA_CACHE_AGE_HOURS = Number($env.MAX_FIGMA_CACHE_AGE_HOURS || 168);

function parseSseJson(raw) {
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    return raw;
  }

  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');

  try {
    return JSON.parse(text);
  } catch {
    // SSE fallback handled below.
  }

  const dataChunks = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .filter((line) => line !== '[DONE]');

  if (!dataChunks.length) {
    throw new Error('Reponse MCP invalide: payload JSON ou data SSE manquant');
  }

  for (let index = dataChunks.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(dataChunks[index]);
    } catch {
      // Keep searching until a valid JSON payload is found.
    }
  }

  throw new Error('Reponse MCP invalide: aucun bloc data SSE JSON exploitable');
}

function extractStructuredContent(payload, toolName) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Reponse MCP invalide pour ${toolName}: payload vide`);
  }

  if (payload.error) {
    const message = payload.error.message || JSON.stringify(payload.error);
    throw new Error(`Erreur MCP ${toolName}: ${message}`);
  }

  const result = payload.result;
  if (!result || typeof result !== 'object') {
    throw new Error(`Reponse MCP invalide pour ${toolName}: result manquant`);
  }

  return result.structuredContent ?? null;
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
    timeout: 30000,
  });

  const payload = parseSseJson(raw);
  return extractStructuredContent(payload, name);
}

const incomingItems = $input.all();
const outputItems = [];

for (const item of incomingItems) {
  const data = item?.json || {};
  const componentName = String(data.componentName || '').trim();

  if (data.error) {
    throw new Error(`Filtre composants en erreur: ${data.details || data.error}`);
  }

  if (data.stop || !componentName) {
    console.log(data.message || 'Aucun composant a enrichir par le contexte MCP.');
    continue;
  }

  const context = await callMcpTool.call(this, MCP_TOOL_NAME, {
    name: componentName,
    tokens: data.sourceTokens,
    sourceRef: data.sourceRef,
  });

  if (!context || !context.component || !context.component.name) {
    throw new Error(`Contexte MCP incomplet pour ${componentName}`);
  }

  if (String(context.component.name).toLowerCase() !== componentName.toLowerCase()) {
    throw new Error(`Contexte MCP incoherent: demande=${componentName}, reponse=${context.component.name}`);
  }

  if (!context.component.htmlTag || !context.component.rootClass) {
    throw new Error(`Contrat MCP incomplet pour ${componentName}: htmlTag/rootClass manquant`);
  }

  if (context.component.requiresFigma && !context.figma?.available) {
    throw new Error(`Figma indisponible pour ${componentName} alors que le workflow exige un contexte Figma`);
  }

  if (context.component.requiresFigma && !context.figma?.complete) {
    throw new Error(
      `Cache Figma incomplet pour ${componentName}: ${context.figma?.actualVariantCount || 0}/${context.figma?.expectedVariantCount || '?'} variantes`,
    );
  }

  const cachedAt = Date.parse(context.figma?.cachedAt || '');
  const cacheAgeHours = Number.isFinite(cachedAt) ? (Date.now() - cachedAt) / 3600000 : Infinity;
  if (context.component.requiresFigma && cacheAgeHours > MAX_FIGMA_CACHE_AGE_HOURS) {
    throw new Error(`Cache Figma trop ancien pour ${componentName}: ${Math.floor(cacheAgeHours)}h`);
  }

  outputItems.push({
    json: {
      ...data,
      mcpContext: context,
    },
  });
}

return outputItems;
