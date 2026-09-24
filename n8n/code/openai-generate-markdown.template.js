const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const MCP_ENDPOINT = 'http://127.0.0.1:3101/mcp';
const OPENAI_MODEL = $env.OPENAI_MODEL || 'gpt-5.4-nano';
const OPENAI_REASONING_EFFORT = $env.OPENAI_REASONING_EFFORT || 'none';
const OPENAI_MAX_OUTPUT_TOKENS = Number($env.OPENAI_MAX_OUTPUT_TOKENS || 2500);
const OPENAI_MAX_REPAIR_TOKENS = Number($env.OPENAI_MAX_REPAIR_TOKENS || 1200);
const SYSTEM_PROMPT = __SYSTEM_PROMPT__;

function getApiKey() {
  const apiKey = $env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manque dans n8n. Ajoutez-la puis redemarrez n8n.');
  return apiKey;
}

function parseSseJson(raw) {
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
  try { return JSON.parse(text); } catch {}
  const chunks = text.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('data:'));
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(chunks[index].slice(5).trim()); } catch {}
  }
  throw new Error('Reponse MCP invalide');
}

async function callMcpTool(name, args) {
  const raw = await this.helpers.httpRequest({
    method: 'POST', url: MCP_ENDPOINT,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    returnFullResponse: false, timeout: 30000,
  });
  const payload = parseSseJson(raw);
  if (payload.error) throw new Error(payload.error.message || 'Erreur MCP');
  return payload.result?.structuredContent || null;
}

function compactBlueprint(ctx) {
  const blueprint = ctx.figma?.blueprint || {};
  return {
    shell: blueprint.shell,
    axes: blueprint.axes || {},
    variants: blueprint.variants || [],
    textNodes: blueprint.textNodes,
  };
}

function compactContext(ctx = {}) {
  const tokenMap = new Map();
  for (const item of [...(ctx.contract?.componentTokens || []), ...(ctx.contract?.referencedTokens || [])]) {
    if (item?.cssVar) tokenMap.set(item.cssVar, item.resolvedValue);
  }
  const allowedCssVars = Array.isArray(ctx.contract?.allowedCssVars)
    ? ctx.contract.allowedCssVars
    : [...tokenMap.keys()];
  return {
    source: {
      type: 'mcp:get_component_generation_context',
      instruction: 'Do not infer component information outside this JSON payload.',
    },
    component: {
      name: ctx.component?.name, htmlTag: ctx.component?.htmlTag, rootClass: ctx.component?.rootClass,
      autoDiscovered: ctx.component?.autoDiscovered === true,
      semanticHtmlKnown: ctx.component?.semanticHtmlKnown !== false,
      devContractSource: ctx.component?.devContractSource || null,
      role: ctx.component?.role || null,
      interactive: ctx.component?.interactive === true,
      allowedProps: ctx.component?.allowedProps || [],
      slots: ctx.component?.slots || [],
      axes: ctx.component?.axes || {},
      variants: ctx.component?.variants || [], sizes: ctx.component?.sizes || [], states: ctx.component?.states || [],
      previewMatrix: ctx.component?.previewMatrix, renderRequirements: ctx.component?.renderRequirements,
      usageRules: ctx.component?.usageRules, accessibility: ctx.component?.accessibility,
      accessibilitySpec: ctx.component?.accessibilitySpec,
    },
    figma: { matchedKey: ctx.figma?.matchedKey, cachedAt: ctx.figma?.cachedAt, blueprint: compactBlueprint(ctx) },
    allowedCssVars,
    tokenValues: [...tokenMap.entries()],
    jsxBlueprint: ctx.outputRequirements?.jsxBlueprint,
  };
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  for (const item of response?.output || []) {
    for (const block of item?.content || []) if (typeof block?.text === 'string') return block.text;
  }
  return '';
}

async function enforceExactPreview(componentName, markdown, data) {
  const normalized = await callMcpTool.call(this, 'enforce_exact_figma_preview', {
    name: componentName,
    markdown,
    tokens: data.sourceTokens,
    sourceRef: data.sourceRef,
  });
  if (normalized?.error) throw new Error(normalized.error);
  return {
    markdown: normalized?.markdown || markdown,
    preview: {
      exact: normalized?.exact === true,
      enforced: normalized?.enforced === true,
      warning: normalized?.warning || null,
    },
  };
}

function retryable(error) {
  const status = Number(error?.statusCode || error?.response?.status || 0);
  const code = error?.response?.data?.error?.code || error?.response?.data?.code || error?.code;
  if (code === 'insufficient_quota' || code === 'invalid_api_key') return false;
  return status === 429 || status >= 500;
}

function retryableOpenAiResponse(response) {
  const status = Number(response?.statusCode || 0);
  const code = response?.body?.error?.code || response?.body?.code;
  if (code === 'insufficient_quota' || code === 'invalid_api_key') return false;
  return status === 429 || status >= 500;
}

function formatDetails(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatOpenAiHttpError(response) {
  const status = response?.statusCode || 'unknown';
  const body = response?.body || {};
  const details = body?.error || body;
  return `OpenAI API error ${status}: ${formatDetails(details) || 'reponse vide'}`;
}

function formatOpenAiTransportError(error) {
  const status = error?.statusCode || error?.response?.status || 'unknown';
  const data = error?.response?.data || error?.error || error?.message || null;
  return `OpenAI API transport error ${status}: ${formatDetails(data) || 'requete impossible'}`;
}

async function requestOpenAi(input, maxOutputTokens) {
  const body = {
    model: OPENAI_MODEL, instructions: SYSTEM_PROMPT, input, max_output_tokens: maxOutputTokens,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await this.helpers.httpRequest({
        method: 'POST', url: OPENAI_ENDPOINT,
        headers: { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' },
        body, json: true, returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 180000,
      });
      const status = Number(response?.statusCode || 200);
      if (status >= 400) {
        if (attempt === 0 && retryableOpenAiResponse(response)) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        throw new Error(formatOpenAiHttpError(response));
      }
      return response.body;
    } catch (error) {
      if (String(error?.message || '').startsWith('OpenAI API error ')) throw error;
      if (!retryable(error)) throw new Error(formatOpenAiTransportError(error));
      if (attempt) throw new Error(formatOpenAiTransportError(error));
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
}

const outputItems = [];
for (const item of $input.all()) {
  const data = item?.json || {};
  const componentName = String(data.componentName || '').trim();
  if (!componentName) continue;
  const compact = compactContext(data.mcpContext || {});
  const firstInput = [
    `Composant: ${componentName}`,
    'Contexte MCP JSON. Utilise uniquement ce JSON. Ne demande aucun outil. Ne complete rien par interpretation.',
    JSON.stringify(compact),
  ].join('\n');
  const firstResponse = await requestOpenAi.call(this, firstInput, OPENAI_MAX_OUTPUT_TOKENS);
  let text = extractOutputText(firstResponse).trim();
  if (!text) throw new Error(`OpenAI n'a retourne aucun markdown pour ${componentName}`);
  let previewResult = await enforceExactPreview.call(this, componentName, text, data);
  text = previewResult.markdown;

  let validation = await callMcpTool.call(this, 'validate_component_markdown', {
    name: componentName, markdown: text, tokens: data.sourceTokens, sourceRef: data.sourceRef,
    allowVisualApproximation: Boolean(previewResult.preview.warning),
  });
  let repairResponse = null;
  if (!validation?.valid) {
    const repairInput = [
      'Corrige uniquement les erreurs ci-dessous et retourne tout le Markdown final, sans explication autour.',
      'Reverifie chaque valeur exacte dans component.renderRequirements et figma.blueprint.',
      'Chaque variable CSS doit etre un appel var(--nom-litteral), jamais un nom construit dynamiquement.',
      'unknownCssVars doit etre vide: supprime tous les alias et toutes les declarations de custom properties locales; utilise des selecteurs CSS explicites.',
      `Erreurs MCP:\n${JSON.stringify(validation?.checks || {})}`,
      `Contexte MCP JSON:\n${JSON.stringify(compact)}`,
      `Sortie invalide:\n${text}`,
    ].join('\n\n');
    repairResponse = await requestOpenAi.call(this, repairInput, OPENAI_MAX_REPAIR_TOKENS);
    text = extractOutputText(repairResponse).trim();
    previewResult = await enforceExactPreview.call(this, componentName, text, data);
    text = previewResult.markdown;
    validation = await callMcpTool.call(this, 'validate_component_markdown', {
      name: componentName, markdown: text, tokens: data.sourceTokens, sourceRef: data.sourceRef,
      allowVisualApproximation: Boolean(previewResult.preview.warning),
    });
  }
  if (!validation?.valid) throw new Error(`Validation finale impossible pour ${componentName}: ${JSON.stringify(validation?.checks || {})}`);

  outputItems.push({ json: {
    text, provider: 'openai', model: OPENAI_MODEL, componentName,
    preview: previewResult.preview,
    repairUsed: !!repairResponse,
    openaiResponseIds: [firstResponse?.id, repairResponse?.id].filter(Boolean),
    usage: [firstResponse?.usage, repairResponse?.usage].filter(Boolean),
  } });
}
return outputItems;
