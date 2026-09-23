import React, { useState } from 'react';
import './ds-theme.css';

const PALETTES = {
  "brand": [
    {
      "name": "wine-50",
      "path": "core.brand.wine.50",
      "cssName": "--core-brand-wine-50",
      "value": "#fdf2f6",
      "resolved": "#fdf2f6",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-100",
      "path": "core.brand.wine.100",
      "cssName": "--core-brand-wine-100",
      "value": "#fce7f0",
      "resolved": "#fce7f0",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-200",
      "path": "core.brand.wine.200",
      "cssName": "--core-brand-wine-200",
      "value": "#f9c9dc",
      "resolved": "#f9c9dc",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-300",
      "path": "core.brand.wine.300",
      "cssName": "--core-brand-wine-300",
      "value": "#f29bb9",
      "resolved": "#f29bb9",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-400",
      "path": "core.brand.wine.400",
      "cssName": "--core-brand-wine-400",
      "value": "#e85f8f",
      "resolved": "#e85f8f",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-500",
      "path": "core.brand.wine.500",
      "cssName": "--core-brand-wine-500",
      "value": "#d80049",
      "resolved": "#d80049",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-600",
      "path": "core.brand.wine.600",
      "cssName": "--core-brand-wine-600",
      "value": "#b8003e",
      "resolved": "#b8003e",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-700",
      "path": "core.brand.wine.700",
      "cssName": "--core-brand-wine-700",
      "value": "#8f0038",
      "resolved": "#8f0038",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-800",
      "path": "core.brand.wine.800",
      "cssName": "--core-brand-wine-800",
      "value": "#69002f",
      "resolved": "#69002f",
      "description": "",
      "type": "color"
    },
    {
      "name": "wine-900",
      "path": "core.brand.wine.900",
      "cssName": "--core-brand-wine-900",
      "value": "#4a0023",
      "resolved": "#4a0023",
      "description": "",
      "type": "color"
    }
  ],
  "neutral": [
    {
      "name": "warm-0",
      "path": "core.neutral.warm.0",
      "cssName": "--core-neutral-warm-0",
      "value": "#ffffff",
      "resolved": "#ffffff",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-50",
      "path": "core.neutral.warm.50",
      "cssName": "--core-neutral-warm-50",
      "value": "#fcf9f7",
      "resolved": "#fcf9f7",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-100",
      "path": "core.neutral.warm.100",
      "cssName": "--core-neutral-warm-100",
      "value": "#f6f1ef",
      "resolved": "#f6f1ef",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-200",
      "path": "core.neutral.warm.200",
      "cssName": "--core-neutral-warm-200",
      "value": "#e9e1dd",
      "resolved": "#e9e1dd",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-300",
      "path": "core.neutral.warm.300",
      "cssName": "--core-neutral-warm-300",
      "value": "#d3c8c2",
      "resolved": "#d3c8c2",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-400",
      "path": "core.neutral.warm.400",
      "cssName": "--core-neutral-warm-400",
      "value": "#a99d97",
      "resolved": "#a99d97",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-500",
      "path": "core.neutral.warm.500",
      "cssName": "--core-neutral-warm-500",
      "value": "#7d726d",
      "resolved": "#7d726d",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-600",
      "path": "core.neutral.warm.600",
      "cssName": "--core-neutral-warm-600",
      "value": "#5e5551",
      "resolved": "#5e5551",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-700",
      "path": "core.neutral.warm.700",
      "cssName": "--core-neutral-warm-700",
      "value": "#423b38",
      "resolved": "#423b38",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-800",
      "path": "core.neutral.warm.800",
      "cssName": "--core-neutral-warm-800",
      "value": "#282321",
      "resolved": "#282321",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-900",
      "path": "core.neutral.warm.900",
      "cssName": "--core-neutral-warm-900",
      "value": "#151311",
      "resolved": "#151311",
      "description": "",
      "type": "color"
    },
    {
      "name": "warm-1000",
      "path": "core.neutral.warm.1000",
      "cssName": "--core-neutral-warm-1000",
      "value": "#000000",
      "resolved": "#000000",
      "description": "",
      "type": "color"
    }
  ],
  "feedback": [
    {
      "name": "danger-100",
      "path": "core.feedback.danger.100",
      "cssName": "--core-feedback-danger-100",
      "value": "#fde8ea",
      "resolved": "#fde8ea",
      "description": "",
      "type": "color"
    },
    {
      "name": "danger-500",
      "path": "core.feedback.danger.500",
      "cssName": "--core-feedback-danger-500",
      "value": "#c82c3d",
      "resolved": "#c82c3d",
      "description": "",
      "type": "color"
    },
    {
      "name": "info-100",
      "path": "core.feedback.info.100",
      "cssName": "--core-feedback-info-100",
      "value": "#e6f0fb",
      "resolved": "#e6f0fb",
      "description": "",
      "type": "color"
    },
    {
      "name": "info-500",
      "path": "core.feedback.info.500",
      "cssName": "--core-feedback-info-500",
      "value": "#3568d4",
      "resolved": "#3568d4",
      "description": "",
      "type": "color"
    },
    {
      "name": "success-100",
      "path": "core.feedback.success.100",
      "cssName": "--core-feedback-success-100",
      "value": "#e7f6ec",
      "resolved": "#e7f6ec",
      "description": "",
      "type": "color"
    },
    {
      "name": "success-500",
      "path": "core.feedback.success.500",
      "cssName": "--core-feedback-success-500",
      "value": "#16875c",
      "resolved": "#16875c",
      "description": "",
      "type": "color"
    },
    {
      "name": "warning-100",
      "path": "core.feedback.warning.100",
      "cssName": "--core-feedback-warning-100",
      "value": "#fff3d6",
      "resolved": "#fff3d6",
      "description": "",
      "type": "color"
    },
    {
      "name": "warning-500",
      "path": "core.feedback.warning.500",
      "cssName": "--core-feedback-warning-500",
      "value": "#d98700",
      "resolved": "#d98700",
      "description": "",
      "type": "color"
    }
  ],
  "overlay": [
    {
      "name": "black-8",
      "path": "core.overlay.black.8",
      "cssName": "--core-overlay-black-8",
      "value": "rgba(0, 0, 0, 0.078)",
      "resolved": "rgba(0, 0, 0, 0.078)",
      "description": "",
      "type": "color"
    },
    {
      "name": "black-16",
      "path": "core.overlay.black.16",
      "cssName": "--core-overlay-black-16",
      "value": "rgba(0, 0, 0, 0.161)",
      "resolved": "rgba(0, 0, 0, 0.161)",
      "description": "",
      "type": "color"
    },
    {
      "name": "black-48",
      "path": "core.overlay.black.48",
      "cssName": "--core-overlay-black-48",
      "value": "rgba(0, 0, 0, 0.478)",
      "resolved": "rgba(0, 0, 0, 0.478)",
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

function ColorPage({ title, tokens }) {
  const [copied, setCopied] = useState(null);
  return (
    <div className="ds-page">
      <header className="ds-header">
        <div className="ds-header-row"><h1 className="ds-title">{title} Palette</h1><span className="ds-count">{tokens.length} tokens</span></div>
        <p className="ds-subtitle">Swatches cliquables pour copier le nom de variable CSS, avec valeur hex et usage documenté.</p>
      </header>
      <div className="ds-grid">
        {tokens.map((token) => (
          <button key={token.path} className="ds-card ds-swatch ds-clickable" onClick={() => copyToken(token.cssName, setCopied)} type="button">
            <span className="ds-swatch-color" style={{ background: token.resolved }} />
            <span>
              <span className="ds-token-name">{token.name}</span><br />
              <span className="ds-token-value">{token.resolved}</span>
              {token.description && <span className="ds-description">{token.description}</span>}
            </span>
            {copied === token.cssName && <span className="ds-copied">Copied!</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default { title: 'Design System/Colors' };

export const Brand = () => <ColorPage title="Brand" tokens={PALETTES.brand} />;

export const Neutral = () => <ColorPage title="Neutral" tokens={PALETTES.neutral} />;

export const Feedback = () => <ColorPage title="Feedback" tokens={PALETTES.feedback} />;

export const Overlay = () => <ColorPage title="Overlay" tokens={PALETTES.overlay} />;
