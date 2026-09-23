import React from 'react';
import './ds-theme.css';

const SHADOWS = [];

export default { title: 'Design System/Shadows' };

export const Scale = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row"><h1 className="ds-title">Shadows Scale</h1><span className="ds-count">{SHADOWS.length} tokens</span></div>
      <p className="ds-subtitle">Rectangles blancs sur fond gris pour comparer les élévations.</p>
    </header>
    <div className="ds-shadow-grid">
      {SHADOWS.map((item) => (
        <div className="ds-card ds-shadow-card" key={item.path}>
          <div className="ds-shadow-box" style={{ boxShadow: item.resolved }} />
          <div className="ds-token-name">{item.name}</div>
          <div className="ds-token-value">{item.resolved}</div>
        </div>
      ))}
    </div>
  </div>
);
