const MCP_ENDPOINT = 'http://127.0.0.1:3101/mcp';

export function sanitizeMarkdownForValidation(markdown) {
  const text = String(markdown || '').trim();
  if (!text) return '';
  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) {
    return `${text}\n\`\`\`\n`;
  }
  return text;
}

function parseSseJson(raw) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLine = [...lines].reverse().find((line) => line.startsWith('data: '));
  if (!dataLine) {
    throw new Error('Reponse MCP invalide.');
  }
  return JSON.parse(dataLine.slice(6));
}

export function getValidationIssues(validation) {
  const checks = validation?.checks || {};
  const issues = [];

  if (checks.sections && !checks.sections.hasDescription) {
    issues.push('La section Description est manquante.');
  }
  if (checks.sections && !checks.sections.hasSpec) {
    issues.push('La section Spec est manquante.');
  }
  if (checks.sections && !checks.sections.hasDoDont) {
    issues.push("La section Do & Don't est manquante.");
  }
  if (checks.sections && !checks.sections.hasCode) {
    issues.push('La section Code interactif avec bloc JSX est manquante.');
  }
  if (checks.rootTagOk === false) {
    issues.push("Le composant racine attendu n'a pas ete detecte dans le code.");
  }
  if (Array.isArray(checks.unknownCssVars) && checks.unknownCssVars.length) {
    issues.push(`Variables CSS inconnues : ${checks.unknownCssVars.join(', ')}`);
  }
  if (Array.isArray(checks.illegalVariants) && checks.illegalVariants.length) {
    issues.push(`Variants invalides : ${checks.illegalVariants.join(', ')}`);
  }
  if (Array.isArray(checks.illegalSizes) && checks.illegalSizes.length) {
    issues.push(`Tailles invalides : ${checks.illegalSizes.join(', ')}`);
  }
  if (checks.visualContractOk === false) {
    const missing = checks.visualContract?.missingLengths || [];
    issues.push(
      missing.length
        ? `Contrat visuel Figma incomplet. Valeurs absentes : ${missing.map((value) => `${value}px`).join(', ')}`
        : 'Le texte, le glyphe ou le contenu de la démo ne correspond pas exactement à Figma.'
    );
  }

  return issues;
}

export async function validateComponentMarkdownWithMcp(componentName, markdown, options = {}) {
  const sanitizedMarkdown = sanitizeMarkdownForValidation(markdown);
  if (!componentName || !sanitizedMarkdown) {
    return {
      status: 'invalid',
      message: 'Le contenu du composant est vide.',
      issues: ['Aucun contenu a valider.'],
      validation: null,
    };
  }

  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'validate_component_markdown',
        arguments: {
          name: componentName,
          markdown: sanitizedMarkdown,
          tokens: options.tokens,
          sourceRef: options.sourceRef,
          allowVisualApproximation: options.allowVisualApproximation === true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Serveur MCP indisponible (${response.status}).`);
  }

  const payload = parseSseJson(await response.text());
  const validation = payload?.result?.structuredContent || null;
  const issues = getValidationIssues(validation);

  if (validation?.valid) {
    return {
      status: 'valid',
      message: 'Validation MCP OK.',
      issues: [],
      validation,
    };
  }

  return {
    status: 'invalid',
    message: 'Le contenu edite ne passe pas encore la validation MCP.',
    issues: issues.length ? issues : ['Validation MCP en echec.'],
    validation,
  };
}
