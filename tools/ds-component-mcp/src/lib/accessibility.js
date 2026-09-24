// Static checks are evidence about the Storybook preview, not WCAG conformance.
// Keyboard, assistive-technology, zoom and contrast checks remain manual.
export function auditAccessibilityPreview(code, context) {
  const source = String(code || '');
  const component = context?.component || {};
  const spec = component.accessibilitySpec || {};
  const staticChecks = [];
  const add = (id, passed, detail) => staticChecks.push({ id, status: passed ? 'pass' : 'gap', detail });

  if (component.name === 'button') {
    add('native-control', /<button\b/i.test(source), 'Bouton HTML natif présent dans le JSX.');
    add('disabled', /<button\b[\s\S]*?\bdisabled(?:\s|=|\})/i.test(source), 'État disabled natif présent dans le JSX.');
    add('focus', /\.thiga-button:focus-visible\s*\{[^}]*\boutline\s*:/i.test(source), 'Style :focus-visible du bouton présent dans le CSS de preview.');
  }

  if (component.name === 'dataTable') {
    add('table-structure', /<table\b/i.test(source) && /<th\b/i.test(source), 'Le rendu de revue doit distinguer le tableau visuel d’un tableau HTML sémantique de production.');
  }

  if (component.name === 'listItem') {
    add('selection-semantics', !/role\s*=\s*["']listitem["'][^>]*aria-selected|aria-selected[^>]*role\s*=\s*["']listitem["']/i.test(source), 'aria-selected ne doit pas être associé à role=listitem.');
  }

  const unresolvedContract = spec.source === 'missing-contract' || !spec.source;
  return {
    target: spec.target || 'WCAG 2.2 AA — objectif de revue, pas attestation de conformité',
    source: spec.source || 'missing-contract',
    staticChecks,
    manualChecks: spec.manualChecks || [],
    openQuestions: unresolvedContract
      ? ['Contrat développeur/accessibilité manquant : définir la sémantique, le clavier et les états.']
      : component.semanticHtmlKnown === false
        ? ['Le balisage sémantique de production n’est pas défini par Figma.']
        : [],
    reviewRequired: unresolvedContract
      || staticChecks.some((check) => check.status !== 'pass')
      || (spec.manualChecks || []).length > 0
      || component.semanticHtmlKnown === false,
  };
}
