// =====================================================================
// xmlTagsToMarkdown.js
// Convertit le format XML du workflow n8n en markdown structure
// compatible avec docSections.js et LiveMarkdownViewer.
//
// Sortie attendue par l'AI Editor :
//   1. Preview live du composant (avec etats)
//   2. Do / Don't
//   3. Description developpeur
//   4. Code interactif
// =====================================================================

// Extrait le contenu entre balises XML.
// Gere les balises non fermees quand un ancien modele coupe par max_tokens.
function extractTag(text, tag) {
  // D'abord essayer avec balise fermante
  const closedRegex = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i');
  const closedMatch = text.match(closedRegex);
  if (closedMatch) return closedMatch[1].trim();

  // Balise non fermee : extraire depuis l'ouverture jusqu'a la prochaine
  // balise ouvrante ou la fin du texte
  const openRegex = new RegExp('<' + tag + '>([\\s\\S]*?)(?=<(?:token_mapping|css|react|story|tokens_manquants)>|$)', 'i');
  const openMatch = text.match(openRegex);
  if (openMatch && openMatch[1].trim().length > 0) return openMatch[1].trim();

  return null;
}

function buildUnavailablePreview(reason = 'Le composant doit etre regenere depuis le workflow n8n.') {
  return `render(
  <div
    style={{
      padding: '24px',
      border: '1px solid var(--color-border-default, #e5e7eb)',
      borderRadius: '16px',
      background: 'var(--color-bg-primary, #ffffff)',
      color: 'var(--color-text-primary, #111827)',
      fontFamily: 'var(--font-family-default, sans-serif)'
    }}
  >
    <strong>Apercu indisponible</strong>
    <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary, #4b5563)' }}>
      ${reason}
    </p>
  </div>
);`;
}

export function hasXmlTags(text) {
  if (!text || typeof text !== 'string') return false;
  return text.includes('<token_mapping>') || text.includes('<css>') || text.includes('<react>');
}

// Genere un bloc JSX live qui injecte le CSS et rend le composant
// avec tous ses etats/variantes.
function buildLiveCode(css, reactCode) {
  const cleanCss = css
    .replace(/\/\*\s*={5,}[\s\S]*?={5,}\s*\*\//g, '')
    .replace(/\/\*\s*-{5,}[\s\S]*?-{5,}\s*\*\//g, '')
    .trim();

  const escapedCss = cleanCss
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  // Si du code React legacy est fourni, on le combine avec le CSS
  if (reactCode) {
    const code = reactCode.trim();

    // Nettoyer les imports et exports (non supportes par react-live)
    const cleaned = code
      .replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '')
      .replace(/export\s+default\s+/g, '')
      .replace(/export\s+/g, '')
      .replace(/interface\s+\w+\s*\{[\s\S]*?\}\n?/g, '');

    // Injecter le CSS en <style> dans le code React
    const hasRender = cleaned.includes('render(');

    if (hasRender) {
      // Inserer le style tag avant le render()
      const withStyle = `const __injectedCss = \`${escapedCss}\`;\n\n${cleaned.replace(
        /render\s*\(/,
        'render(<>\n<style>{__injectedCss}</style>\n'
      )}`;
      // Fermer le Fragment si on l'a ouvert
      return withStyle.replace(/render\(<>\n<style>\{__injectedCss\}<\/style>\n([\s\S]*?)\);/,
        'render(<>\n<style>{__injectedCss}</style>\n$1</>);');
    }

    // Pas de render() : on wrap le tout
    const compMatch = cleaned.match(/(?:const|function)\s+([A-Z][a-zA-Z0-9_]*)/);
    const compName = compMatch ? compMatch[1] : null;

    if (compName) {
      return `const __css = \`${escapedCss}\`;\n\n${cleaned}\n\nrender(<>\n  <style>{__css}</style>\n  <${compName} />\n</>);`;
    }

    // Fallback : juste le code avec le CSS
    return `const __css = \`${escapedCss}\`;\n\n${cleaned}`;
  }

  // Pas de code React : generer une demo automatique a partir du CSS BEM
  const classRegex = /^\.([\w-]+(?:(?:--|__)\w[\w-]*)?)\s*[{,]/gm;
  const allClasses = [];
  let m;
  while ((m = classRegex.exec(cleanCss)) !== null) {
    if (!allClasses.includes(m[1])) allClasses.push(m[1]);
  }

  // Trouver le bloc principal (sans -- ni __)
  const mainClass = allClasses.find(c => !c.includes('--') && !c.includes('__')) || allClasses[0] || 'component';
  // Variantes BEM (--modifier)
  const variants = allClasses.filter(c => c.startsWith(mainClass + '--'));

  // Determiner le tag HTML selon le nom du composant
  const isButton = mainClass.toLowerCase().includes('btn') || mainClass.toLowerCase().includes('button');
  const isInput = mainClass.toLowerCase().includes('input') || mainClass.toLowerCase().includes('field');
  const isBadge = mainClass.toLowerCase().includes('badge') || mainClass.toLowerCase().includes('tag');
  const isCard = mainClass.toLowerCase().includes('card');
  const htmlTag = isButton ? 'button' : isInput ? 'input' : 'div';

  if (!reactCode) {
    const looksLikeLegacyButton =
      isButton && (
        cleanCss.includes('TOKEN_MANQUANT')
        || cleanCss.includes('--component-button-')
        || cleanCss.includes('var(--semantic-color-action-primary')
      );
    const looksLikeLegacyCard =
      isCard && (
        cleanCss.includes('TOKEN_MANQUANT')
        || cleanCss.includes('--component-card-')
        || cleanCss.includes('.card--interactive')
      );

    if (looksLikeLegacyButton || looksLikeLegacyCard) {
      return buildUnavailablePreview('Le code legacy ne suit plus le workflow single source of truth. Relancez la generation n8n pour produire un vrai JSX dans tokens-docs.json.');
    }
  }

  // Generer les elements de demo
  let demoItems;

  if (isInput) {
    demoItems = [
      `      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '400px' }}>`,
      `        <${htmlTag} className="${mainClass}" placeholder="Default state" />`,
      `        <${htmlTag} className="${mainClass}" placeholder="Disabled state" disabled />`,
      ...variants.map(v => {
        const label = v.split('--').pop();
        return `        <${htmlTag} className="${v}" placeholder="${label}" />`;
      }),
      `      </div>`
    ].join('\n');
  } else if (isCard) {
    demoItems = [
      `      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', width: '100%' }}>`,
      `        <div className="${mainClass}"><h3>Card Title</h3><p>Card content example</p></div>`,
      ...variants.map(v => {
        const label = v.split('--').pop();
        return `        <div className="${v}"><h3>${label}</h3><p>Card content</p></div>`;
      }),
      `      </div>`
    ].join('\n');
  } else {
    // Boutons, badges, etc.
    const stateItems = [
      `        <${htmlTag} className="${mainClass}">Default</${htmlTag}>`,
    ];
    // Etats explicites
    if (cleanCss.includes(':disabled') || cleanCss.includes('.is-disabled')) {
      stateItems.push(`        <${htmlTag} className="${mainClass}" disabled>Disabled</${htmlTag}>`);
    }
    // Variantes
    for (const v of variants) {
      const label = v.split('--').pop();
      stateItems.push(`        <${htmlTag} className="${v}">${label}</${htmlTag}>`);
    }

    demoItems = [
      `      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>`,
      ...stateItems,
      `      </div>`
    ].join('\n');
  }

  return `const css = \`${escapedCss}\`;

const Demo = () => (
  <div style={{ padding: '24px' }}>
    <style>{css}</style>
${demoItems}
  </div>
);

render(<Demo />);`;
}

function isIncompleteCss(css) {
  const value = String(css || '').trim();
  if (!value) return false;

  const openComments = (value.match(/\/\*/g) || []).length;
  const closeComments = (value.match(/\*\//g) || []).length;
  const openBraces = (value.match(/\{/g) || []).length;
  const closeBraces = (value.match(/\}/g) || []).length;

  return openComments !== closeComments || openBraces !== closeBraces;
}

function buildKnownComponentPreview(compName) {
  return buildUnavailablePreview(`La preview auto pour "${compName}" est desactivee. Storybook doit afficher uniquement le JSX present dans tokens-docs.json.`);
}

// Genere une preview JSX a partir du token_mapping quand il n'y a pas de CSS/React.
// Parse le tableau markdown pour extraire les classes BEM et generer une demo.
function buildPreviewFromMapping(mappingTable) {
  // Extraire les noms de tokens du tableau pour deviner le composant
  const tokenNames = [];
  const lines = mappingTable.split('\n').filter(l => l.includes('|') && !l.includes('---'));
  for (const line of lines) {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 2 && cols[1].startsWith('--')) {
      tokenNames.push(cols[1]);
    }
  }

  if (tokenNames.length === 0) return null;

  // Deviner le nom du composant depuis les tokens (--component-button-* -> button)
  const firstToken = tokenNames[0] || '';
  const compMatch = firstToken.match(/--component-(\w+)/);
  const compName = compMatch ? compMatch[1] : 'component';
  return buildKnownComponentPreview(compName);
}

// Point d'entree principal : convertit le XML n8n en markdown structure
export function xmlTagsToMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  if (!hasXmlTags(text)) return text;

  const sections = [];

  // --- 1. Code interactif (priorite : c'est la preview live du composant) ---
  const css = extractTag(text, 'css');
  const react = extractTag(text, 'react');
  const tokenMapping = extractTag(text, 'token_mapping');
  const canUseCss = css && !isIncompleteCss(css);

  if (canUseCss || react) {
    // Cas ideal : on a du CSS et/ou du React
    const liveCode = canUseCss ? buildLiveCode(css, react) : react;
    sections.push('## Code interactif (Live Editor)\n');
    sections.push('```jsx');
    sections.push(liveCode);
    sections.push('```');
    sections.push('');
  } else if (tokenMapping) {
    // Fallback legacy : on n'a que le token_mapping
    // Generer une preview a partir des tokens mappes
    const fallbackCode = buildPreviewFromMapping(tokenMapping);
    if (fallbackCode) {
      sections.push('## Code interactif (Live Editor)\n');
      sections.push('```jsx');
      sections.push(fallbackCode);
      sections.push('```');
      sections.push('');
    }
  }

  // --- 2. Tokens manquants (info utile pour le dev) ---
  const missing = extractTag(text, 'tokens_manquants');
  if (missing && missing.trim().length > 0 && !missing.includes('Aucun') && !missing.includes('aucun')) {
    sections.push('## Tokens manquants\n');
    sections.push(missing);
    sections.push('');
  }

  if (sections.length === 0) return text;

  return sections.join('\n');
}
