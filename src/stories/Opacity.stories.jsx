import React from 'react';
import './ds-theme.css';

const OPACITY = [];

export default { title: 'Design System/Opacity' };

export const Scale = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row"><h1 className="ds-title">Opacity Scale</h1><span className="ds-count">{OPACITY.length} tokens</span></div>
      <p className="ds-subtitle">Barres sur fond damier pour rendre la transparence immédiatement visible.</p>
    </header>
    <div className="ds-card ds-scale-list">
      {OPACITY.map((item) => (
        <div className="ds-opacity-row" key={item.path}>
          <span className="ds-token-name">{item.name}</span>
          <span className="ds-checker"><span className="ds-opacity-fill" style={{ opacity: item.resolved }} /></span>
          <span className="ds-token-value">{item.resolved}</span>
        </div>
      ))}
    </div>
  </div>
);
