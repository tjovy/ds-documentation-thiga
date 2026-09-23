import React from 'react';
import { LiveMarkdownViewer } from '../utils/LiveMarkdownViewer';
import DOCS from '../../tokens-docs.json';
import './variables.css';
import './ds-theme.css';

export default { title: 'Design System/Components' };

const componentEntries = Object.entries(DOCS.component || {})
  .map(([name, entry]) => ({
    name,
    description: typeof entry?.description === 'string' ? entry.description.trim() : '',
    meta: entry?._meta || null,
  }))
  .filter((entry) => entry.description.length > 0);

const formatDate = (value) => {
  if (!value) return 'non genere';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const EmptyState = () => (
  <div className="ds-card" style={{ padding: 24 }}>
    <h2 className="ds-token-name" style={{ margin: 0 }}>Aucun composant documente</h2>
    <p className="ds-subtitle" style={{ marginTop: 8 }}>
      Cette page n'affiche pas de preview inventee. Elle attend le Markdown et le JSX valides dans tokens-docs.json.
    </p>
  </div>
);

const ComponentDoc = ({ entry }) => (
  <article className="zh-component-documentation">
    <header className="zh-component-header">
      <div className="ds-header-row">
        <h2 className="ds-title" style={{ fontSize: 24 }}>{entry.name}</h2>
        <span className="ds-count">{entry.meta?.workflowVersion || 'tokens-docs.json'}</span>
      </div>
      <p className="ds-subtitle">
        Source: tokens-docs.json. Variables CSS: src/stories/variables.css.
        {entry.meta?.generatedAt ? ' Genere le ' + formatDate(entry.meta.generatedAt) + '.' : ''}
      </p>
    </header>
    <LiveMarkdownViewer content={entry.description} />
  </article>
);

const ComponentPage = ({ componentName }) => {
  const entry = componentEntries.find((item) => item.name === componentName);
  if (!entry) return <div className="ds-page"><EmptyState /></div>;
  return <div className="ds-page"><ComponentDoc entry={entry} /></div>;
};

export const Overview = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row">
        <h1 className="ds-title">Components</h1>
        <span className="ds-count">{componentEntries.length} composant(s)</span>
      </div>
      <p className="ds-subtitle">
        Rendu strictement alimente par tokens-docs.json. Les couleurs, espacements, rayons et typographies utilises par le JSX viennent des variables CSS importees depuis variables.css.
      </p>
    </header>
    <div style={{ display: 'grid', gap: 20 }}>
      {componentEntries.length > 0
        ? componentEntries.map((entry) => <ComponentDoc key={entry.name} entry={entry} />)
        : <EmptyState />}
    </div>
  </div>
);
