import React, { useState } from 'react';
import './ds-theme.css';

const SEMANTIC = {
  "border": [
    {
      "name": "action",
      "path": "semantic.border.action",
      "cssName": "--semantic-border-action",
      "value": "{core.brand.wine.500}",
      "resolved": "#d80049",
      "description": "",
      "type": "color"
    },
    {
      "name": "brand",
      "path": "semantic.border.brand",
      "cssName": "--semantic-border-brand",
      "value": "{core.brand.wine.800}",
      "resolved": "#69002f",
      "description": "",
      "type": "color"
    },
    {
      "name": "default",
      "path": "semantic.border.default",
      "cssName": "--semantic-border-default",
      "value": "{core.neutral.warm.200}",
      "resolved": "#e9e1dd",
      "description": "",
      "type": "color"
    },
    {
      "name": "disabled",
      "path": "semantic.border.disabled",
      "cssName": "--semantic-border-disabled",
      "value": "{core.neutral.warm.200}",
      "resolved": "#e9e1dd",
      "description": "",
      "type": "color"
    },
    {
      "name": "focus",
      "path": "semantic.border.focus",
      "cssName": "--semantic-border-focus",
      "value": "{core.brand.wine.500}",
      "resolved": "#d80049",
      "description": "",
      "type": "color"
    },
    {
      "name": "strong",
      "path": "semantic.border.strong",
      "cssName": "--semantic-border-strong",
      "value": "{core.neutral.warm.500}",
      "resolved": "#7d726d",
      "description": "",
      "type": "color"
    },
    {
      "name": "subtle",
      "path": "semantic.border.subtle",
      "cssName": "--semantic-border-subtle",
      "value": "{core.neutral.warm.100}",
      "resolved": "#f6f1ef",
      "description": "",
      "type": "color"
    }
  ],
  "icon": [
    {
      "name": "action",
      "path": "semantic.icon.action",
      "cssName": "--semantic-icon-action",
      "value": "{core.brand.wine.500}",
      "resolved": "#d80049",
      "description": "",
      "type": "color"
    },
    {
      "name": "brand",
      "path": "semantic.icon.brand",
      "cssName": "--semantic-icon-brand",
      "value": "{core.brand.wine.800}",
      "resolved": "#69002f",
      "description": "",
      "type": "color"
    },
    {
      "name": "danger",
      "path": "semantic.icon.danger",
      "cssName": "--semantic-icon-danger",
      "value": "{core.feedback.danger.500}",
      "resolved": "#c82c3d",
      "description": "",
      "type": "color"
    },
    {
      "name": "disabled",
      "path": "semantic.icon.disabled",
      "cssName": "--semantic-icon-disabled",
      "value": "{core.neutral.warm.400}",
      "resolved": "#a99d97",
      "description": "",
      "type": "color"
    },
    {
      "name": "inverse",
      "path": "semantic.icon.inverse",
      "cssName": "--semantic-icon-inverse",
      "value": "{core.neutral.warm.0}",
      "resolved": "#ffffff",
      "description": "",
      "type": "color"
    },
    {
      "name": "primary",
      "path": "semantic.icon.primary",
      "cssName": "--semantic-icon-primary",
      "value": "{core.neutral.warm.900}",
      "resolved": "#151311",
      "description": "",
      "type": "color"
    },
    {
      "name": "secondary",
      "path": "semantic.icon.secondary",
      "cssName": "--semantic-icon-secondary",
      "value": "{core.neutral.warm.600}",
      "resolved": "#5e5551",
      "description": "",
      "type": "color"
    },
    {
      "name": "success",
      "path": "semantic.icon.success",
      "cssName": "--semantic-icon-success",
      "value": "{core.feedback.success.500}",
      "resolved": "#16875c",
      "description": "",
      "type": "color"
    }
  ],
  "surface": [
    {
      "name": "action",
      "path": "semantic.surface.action",
      "cssName": "--semantic-surface-action",
      "value": "{core.brand.wine.500}",
      "resolved": "#d80049",
      "description": "",
      "type": "color"
    },
    {
      "name": "actionHover",
      "path": "semantic.surface.actionHover",
      "cssName": "--semantic-surface-actionHover",
      "value": "{core.brand.wine.600}",
      "resolved": "#b8003e",
      "description": "",
      "type": "color"
    },
    {
      "name": "actionPressed",
      "path": "semantic.surface.actionPressed",
      "cssName": "--semantic-surface-actionPressed",
      "value": "{core.brand.wine.700}",
      "resolved": "#8f0038",
      "description": "",
      "type": "color"
    },
    {
      "name": "brand",
      "path": "semantic.surface.brand",
      "cssName": "--semantic-surface-brand",
      "value": "{core.brand.wine.800}",
      "resolved": "#69002f",
      "description": "",
      "type": "color"
    },
    {
      "name": "canvas",
      "path": "semantic.surface.canvas",
      "cssName": "--semantic-surface-canvas",
      "value": "{core.neutral.warm.50}",
      "resolved": "#fcf9f7",
      "description": "",
      "type": "color"
    },
    {
      "name": "danger",
      "path": "semantic.surface.danger",
      "cssName": "--semantic-surface-danger",
      "value": "{core.feedback.danger.100}",
      "resolved": "#fde8ea",
      "description": "",
      "type": "color"
    },
    {
      "name": "default",
      "path": "semantic.surface.default",
      "cssName": "--semantic-surface-default",
      "value": "{core.neutral.warm.0}",
      "resolved": "#ffffff",
      "description": "",
      "type": "color"
    },
    {
      "name": "disabled",
      "path": "semantic.surface.disabled",
      "cssName": "--semantic-surface-disabled",
      "value": "{core.neutral.warm.200}",
      "resolved": "#e9e1dd",
      "description": "",
      "type": "color"
    },
    {
      "name": "info",
      "path": "semantic.surface.info",
      "cssName": "--semantic-surface-info",
      "value": "{core.feedback.info.100}",
      "resolved": "#e6f0fb",
      "description": "",
      "type": "color"
    },
    {
      "name": "inverse",
      "path": "semantic.surface.inverse",
      "cssName": "--semantic-surface-inverse",
      "value": "{core.neutral.warm.900}",
      "resolved": "#151311",
      "description": "",
      "type": "color"
    },
    {
      "name": "overlay",
      "path": "semantic.surface.overlay",
      "cssName": "--semantic-surface-overlay",
      "value": "{core.overlay.black.48}",
      "resolved": "rgba(0, 0, 0, 0.478)",
      "description": "",
      "type": "color"
    },
    {
      "name": "subtle",
      "path": "semantic.surface.subtle",
      "cssName": "--semantic-surface-subtle",
      "value": "{core.neutral.warm.100}",
      "resolved": "#f6f1ef",
      "description": "",
      "type": "color"
    },
    {
      "name": "success",
      "path": "semantic.surface.success",
      "cssName": "--semantic-surface-success",
      "value": "{core.feedback.success.100}",
      "resolved": "#e7f6ec",
      "description": "",
      "type": "color"
    },
    {
      "name": "warning",
      "path": "semantic.surface.warning",
      "cssName": "--semantic-surface-warning",
      "value": "{core.feedback.warning.100}",
      "resolved": "#fff3d6",
      "description": "",
      "type": "color"
    }
  ],
  "text": [
    {
      "name": "action",
      "path": "semantic.text.action",
      "cssName": "--semantic-text-action",
      "value": "{core.brand.wine.600}",
      "resolved": "#b8003e",
      "description": "",
      "type": "color"
    },
    {
      "name": "brand",
      "path": "semantic.text.brand",
      "cssName": "--semantic-text-brand",
      "value": "{core.brand.wine.800}",
      "resolved": "#69002f",
      "description": "",
      "type": "color"
    },
    {
      "name": "danger",
      "path": "semantic.text.danger",
      "cssName": "--semantic-text-danger",
      "value": "{core.feedback.danger.500}",
      "resolved": "#c82c3d",
      "description": "",
      "type": "color"
    },
    {
      "name": "disabled",
      "path": "semantic.text.disabled",
      "cssName": "--semantic-text-disabled",
      "value": "{core.neutral.warm.400}",
      "resolved": "#a99d97",
      "description": "",
      "type": "color"
    },
    {
      "name": "info",
      "path": "semantic.text.info",
      "cssName": "--semantic-text-info",
      "value": "{core.feedback.info.500}",
      "resolved": "#3568d4",
      "description": "",
      "type": "color"
    },
    {
      "name": "inverse",
      "path": "semantic.text.inverse",
      "cssName": "--semantic-text-inverse",
      "value": "{core.neutral.warm.0}",
      "resolved": "#ffffff",
      "description": "",
      "type": "color"
    },
    {
      "name": "onAction",
      "path": "semantic.text.onAction",
      "cssName": "--semantic-text-onAction",
      "value": "{core.neutral.warm.0}",
      "resolved": "#ffffff",
      "description": "",
      "type": "color"
    },
    {
      "name": "primary",
      "path": "semantic.text.primary",
      "cssName": "--semantic-text-primary",
      "value": "{core.neutral.warm.900}",
      "resolved": "#151311",
      "description": "",
      "type": "color"
    },
    {
      "name": "secondary",
      "path": "semantic.text.secondary",
      "cssName": "--semantic-text-secondary",
      "value": "{core.neutral.warm.600}",
      "resolved": "#5e5551",
      "description": "",
      "type": "color"
    },
    {
      "name": "success",
      "path": "semantic.text.success",
      "cssName": "--semantic-text-success",
      "value": "{core.feedback.success.500}",
      "resolved": "#16875c",
      "description": "",
      "type": "color"
    },
    {
      "name": "tertiary",
      "path": "semantic.text.tertiary",
      "cssName": "--semantic-text-tertiary",
      "value": "{core.neutral.warm.500}",
      "resolved": "#7d726d",
      "description": "",
      "type": "color"
    },
    {
      "name": "warning",
      "path": "semantic.text.warning",
      "cssName": "--semantic-text-warning",
      "value": "{core.feedback.warning.500}",
      "resolved": "#d98700",
      "description": "",
      "type": "color"
    }
  ]
};

function copyToken(name, setCopied) {
  navigator.clipboard?.writeText(name);
  setCopied(name);
  window.setTimeout(() => setCopied(null), 1000);
}

function SemanticPage({ title, rows }) {
  const [copied, setCopied] = useState(null);
  return (
    <div className="ds-page">
      <header className="ds-header">
        <div className="ds-header-row"><h1 className="ds-title">Semantic {title}</h1><span className="ds-count">{rows.length} tokens</span></div>
        <p className="ds-subtitle">Références sémantiques résolues vers leurs valeurs core, prêtes à être utilisées en CSS.</p>
      </header>
      <div className="ds-card">
        <table className="ds-table">
          <thead><tr><th>Token</th><th>Référence</th><th>Valeur résolue</th><th>Description</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.path}>
                <td><button className="ds-code ds-clickable" type="button" onClick={() => copyToken(row.cssName, setCopied)}>{row.cssName}</button>{copied === row.cssName && <span className="ds-copied">Copied!</span>}</td>
                <td><span className="ds-mini-swatch" style={{ background: row.resolved }} /> <code>{String(row.value)}</code></td>
                <td><code>{row.resolved}</code></td>
                <td>{row.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default { title: 'Design System/Semantic' };
export const Border = () => <SemanticPage title="Border" rows={SEMANTIC.border} />;
export const Icon = () => <SemanticPage title="Icon" rows={SEMANTIC.icon} />;
export const Surface = () => <SemanticPage title="Surface" rows={SEMANTIC.surface} />;
export const Text = () => <SemanticPage title="Text" rows={SEMANTIC.text} />;
