import React from 'react';
import './ds-theme.css';

const RADIUS = [
  {
    "name": "0",
    "path": "core.radius.0",
    "cssName": "--core-radius-0",
    "value": "0px",
    "resolved": "0px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "4",
    "path": "core.radius.4",
    "cssName": "--core-radius-4",
    "value": "4px",
    "resolved": "4px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "8",
    "path": "core.radius.8",
    "cssName": "--core-radius-8",
    "value": "8px",
    "resolved": "8px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "12",
    "path": "core.radius.12",
    "cssName": "--core-radius-12",
    "value": "12px",
    "resolved": "12px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "16",
    "path": "core.radius.16",
    "cssName": "--core-radius-16",
    "value": "16px",
    "resolved": "16px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "24",
    "path": "core.radius.24",
    "cssName": "--core-radius-24",
    "value": "24px",
    "resolved": "24px",
    "description": "",
    "type": "dimension"
  },
  {
    "name": "full",
    "path": "core.radius.full",
    "cssName": "--core-radius-full",
    "value": "999px",
    "resolved": "999px",
    "description": "",
    "type": "dimension"
  }
];

export default { title: 'Design System/Radius' };

export const Scale = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row"><h1 className="ds-title">Radius Scale</h1><span className="ds-count">{RADIUS.length} tokens</span></div>
      <p className="ds-subtitle">Carrés de 80px avec chaque border-radius appliqué visuellement.</p>
    </header>
    <div className="ds-radius-grid">
      {RADIUS.map((item) => (
        <div className="ds-card ds-radius-card" key={item.path}>
          <div className="ds-radius-box" style={{ borderRadius: item.resolved }} />
          <div className="ds-token-name">{item.name}</div>
          <div className="ds-token-value">{item.resolved}</div>
        </div>
      ))}
    </div>
  </div>
);
