import React from 'react';
import './ds-theme.css';

const SPACING = [
  {
    "name": "0",
    "path": "core.spacing.0",
    "cssName": "--core-spacing-0",
    "value": "0px",
    "resolved": "0px",
    "description": "",
    "type": "dimension",
    "width": "2%"
  },
  {
    "name": "2",
    "path": "core.spacing.2",
    "cssName": "--core-spacing-2",
    "value": "2px",
    "resolved": "2px",
    "description": "",
    "type": "dimension",
    "width": "2.083333333333333%"
  },
  {
    "name": "4",
    "path": "core.spacing.4",
    "cssName": "--core-spacing-4",
    "value": "4px",
    "resolved": "4px",
    "description": "",
    "type": "dimension",
    "width": "4.166666666666666%"
  },
  {
    "name": "8",
    "path": "core.spacing.8",
    "cssName": "--core-spacing-8",
    "value": "8px",
    "resolved": "8px",
    "description": "",
    "type": "dimension",
    "width": "8.333333333333332%"
  },
  {
    "name": "12",
    "path": "core.spacing.12",
    "cssName": "--core-spacing-12",
    "value": "12px",
    "resolved": "12px",
    "description": "",
    "type": "dimension",
    "width": "12.5%"
  },
  {
    "name": "16",
    "path": "core.spacing.16",
    "cssName": "--core-spacing-16",
    "value": "16px",
    "resolved": "16px",
    "description": "",
    "type": "dimension",
    "width": "16.666666666666664%"
  },
  {
    "name": "20",
    "path": "core.spacing.20",
    "cssName": "--core-spacing-20",
    "value": "20px",
    "resolved": "20px",
    "description": "",
    "type": "dimension",
    "width": "20.833333333333336%"
  },
  {
    "name": "24",
    "path": "core.spacing.24",
    "cssName": "--core-spacing-24",
    "value": "24px",
    "resolved": "24px",
    "description": "",
    "type": "dimension",
    "width": "25%"
  },
  {
    "name": "32",
    "path": "core.spacing.32",
    "cssName": "--core-spacing-32",
    "value": "32px",
    "resolved": "32px",
    "description": "",
    "type": "dimension",
    "width": "33.33333333333333%"
  },
  {
    "name": "40",
    "path": "core.spacing.40",
    "cssName": "--core-spacing-40",
    "value": "40px",
    "resolved": "40px",
    "description": "",
    "type": "dimension",
    "width": "41.66666666666667%"
  },
  {
    "name": "48",
    "path": "core.spacing.48",
    "cssName": "--core-spacing-48",
    "value": "48px",
    "resolved": "48px",
    "description": "",
    "type": "dimension",
    "width": "50%"
  },
  {
    "name": "64",
    "path": "core.spacing.64",
    "cssName": "--core-spacing-64",
    "value": "64px",
    "resolved": "64px",
    "description": "",
    "type": "dimension",
    "width": "66.66666666666666%"
  },
  {
    "name": "80",
    "path": "core.spacing.80",
    "cssName": "--core-spacing-80",
    "value": "80px",
    "resolved": "80px",
    "description": "",
    "type": "dimension",
    "width": "83.33333333333334%"
  },
  {
    "name": "96",
    "path": "core.spacing.96",
    "cssName": "--core-spacing-96",
    "value": "96px",
    "resolved": "96px",
    "description": "",
    "type": "dimension",
    "width": "100%"
  }
];

export default { title: 'Design System/Spacing' };

export const Scale = () => (
  <div className="ds-page">
    <header className="ds-header">
      <div className="ds-header-row"><h1 className="ds-title">Spacing Scale</h1><span className="ds-count">{SPACING.length} tokens</span></div>
      <p className="ds-subtitle">Échelle proportionnelle des espacements, lisible par token et par valeur px.</p>
    </header>
    <div className="ds-card ds-scale-list">
      {SPACING.map((item) => (
        <div className="ds-scale-row" key={item.path}>
          <span className="ds-token-name">{item.name}</span>
          <span className="ds-bar-track"><span className="ds-bar-fill" style={{ width: item.width }} /></span>
          <span className="ds-token-value">{item.resolved}</span>
        </div>
      ))}
    </div>
  </div>
);
