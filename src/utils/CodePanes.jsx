import React from 'react';

// Sépare le code normalisé en 3 panneaux : HTML, CSS et JSX des composants.
export const splitCodePanes = (codeString) => {
  let css = '';
  let js = '';
  let html = '';

  // CSS : extraire le template literal const css/__ = `...`
  const cssMatch = codeString.match(/const\s+(?:css|__css|__injectedCss)\s*=\s*`([\s\S]*?)`\s*;/);
  if (cssMatch) {
    css = cssMatch[1]
      .replace(/\\`/g, '`')
      .replace(/\\\\/g, '\\')
      .replace(/\\\$\{/g, '${')
      .trim();
  }

  // HTML : extraire le JSX du return() du composant principal (Demo, etc.)
  const returnMatch = codeString.match(/return\s*\(\s*([\s\S]*?)\n\s*\);\s*\n\s*};/);
  if (returnMatch) {
    html = returnMatch[1]
      .replace(/<style>\{[^}]*\}<\/style>\s*/g, '')
      .trim();
  }

  // JS : les composants/fonctions (sans le CSS literal ni le Demo/render)
  js = codeString
    .replace(/const\s*\{\s*useState\s*\}\s*=\s*React;\s*\n?/g, '')
    .replace(/const\s+(?:css|__css|__injectedCss)\s*=\s*`[\s\S]*?`\s*;/g, '')
    .replace(/const\s+Demo\s*=[\s\S]*?render\s*\([\s\S]*$/, '')
    .replace(/render\s*\([\s\S]*$/, '')
    .replace(/^\s*\n/gm, '')
    .trim();

  // Si pas de CSS extrait, essayer d'extraire les styles inline
  if (!css) {
    const inlineStyles = [];
    const styleRegex = /style=\{\{\s*([^}]+)\s*\}\}/g;
    let m;
    while ((m = styleRegex.exec(codeString)) !== null) {
      const props = m[1].split(',').map(p => {
        const [k, v] = p.split(':').map(s => s.trim());
        if (!k || !v) return null;
        const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^'|'$/g, '');
        const val = v.replace(/^'|'$/g, '').replace(/^"|"$/g, '');
        return `  ${prop}: ${val};`;
      }).filter(Boolean);
      if (props.length) inlineStyles.push(props.join('\n'));
    }
    if (inlineStyles.length) {
      css = '/* Styles extraits du JSX */\n' + inlineStyles.join('\n\n');
    }
  }

  return { html, css, js };
};

// Reassemble les 3 panneaux en un seul bloc de code
export const reassembleCode = (panes) => {
  const parts = [];
  if (panes.css && panes.css.trim()) {
    const escapedCss = panes.css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    parts.push(`const css = \`${escapedCss}\`;`);
  }
  if (panes.js && panes.js.trim()) {
    parts.push(panes.js.trim());
  }
  if (panes.html && panes.html.trim()) {
    parts.push(`const Demo = () => {
  return (
${panes.html.trim()}
  );
};

render(<Demo />);`);
  }
  return parts.join('\n\n');
};

// Style pour les onglets de colonne de code
const codeTabStyle = {
  padding: '6px 12px',
  background: '#2d2d3f',
  color: '#a0aec0',
  fontSize: '11px',
  fontFamily: 'monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #3d3d5c',
};

// Panneau de code read-only
export const CodePane = ({ label, code, last }) => (
  <div style={{
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: last ? 'none' : '1px solid #3d3d5c'
  }}>
    <div style={codeTabStyle}>{label}</div>
    <pre style={{
      margin: 0,
      padding: '12px',
      fontSize: '12px',
      lineHeight: '1.5',
      fontFamily: 'var(--font-family-code, monospace)',
      color: '#e2e8f0',
      overflow: 'auto',
      maxHeight: '260px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }}>
      <code>{code || '// —'}</code>
    </pre>
  </div>
);

// Conteneur 3 colonnes de code (read-only)
export const CodePanesDisplay = ({ codeString }) => {
  const panes = splitCodePanes(codeString);
  return (
    <div style={{ display: 'flex', background: '#1e1e2e', borderRadius: '0 0 8px 8px' }}>
      <CodePane label="HTML" code={panes.html} />
      <CodePane label="CSS" code={panes.css} />
      <CodePane label="JSX" code={panes.js} last />
    </div>
  );
};
