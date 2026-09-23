import React from 'react';
import './ds-theme.css';

const TYPOGRAPHY = {
  "headings": [
    {
      "name": "brand",
      "path": "typography.family.brand",
      "cssName": "--typography-family-brand",
      "value": "DM Sans",
      "resolved": "DM Sans",
      "description": "",
      "type": "string",
      "props": {
        "fontFamily": "DM Sans",
        "fontSize": "32px",
        "lineHeight": "40px"
      }
    },
    {
      "name": "bold",
      "path": "typography.style.bold",
      "cssName": "--typography-style-bold",
      "value": "Bold",
      "resolved": "Bold",
      "description": "",
      "type": "string",
      "props": {
        "fontWeight": "Bold",
        "fontSize": "24px",
        "lineHeight": "32px"
      }
    },
    {
      "name": "extrabold",
      "path": "typography.style.extrabold",
      "cssName": "--typography-style-extrabold",
      "value": "ExtraBold",
      "resolved": "ExtraBold",
      "description": "",
      "type": "string",
      "props": {
        "fontWeight": "ExtraBold",
        "fontSize": "24px",
        "lineHeight": "32px"
      }
    },
    {
      "name": "medium",
      "path": "typography.style.medium",
      "cssName": "--typography-style-medium",
      "value": "Medium",
      "resolved": "Medium",
      "description": "",
      "type": "string",
      "props": {
        "fontWeight": "Medium",
        "fontSize": "24px",
        "lineHeight": "32px"
      }
    },
    {
      "name": "regular",
      "path": "typography.style.regular",
      "cssName": "--typography-style-regular",
      "value": "Regular",
      "resolved": "Regular",
      "description": "",
      "type": "string",
      "props": {
        "fontWeight": "Regular",
        "fontSize": "24px",
        "lineHeight": "32px"
      }
    },
    {
      "name": "semibold",
      "path": "typography.style.semibold",
      "cssName": "--typography-style-semibold",
      "value": "SemiBold",
      "resolved": "SemiBold",
      "description": "",
      "type": "string",
      "props": {
        "fontWeight": "SemiBold",
        "fontSize": "24px",
        "lineHeight": "32px"
      }
    }
  ],
  "body": [
    {
      "name": "12",
      "path": "typography.size.12",
      "cssName": "--typography-size-12",
      "value": "12px",
      "resolved": "12px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "12px"
      }
    },
    {
      "name": "14",
      "path": "typography.size.14",
      "cssName": "--typography-size-14",
      "value": "14px",
      "resolved": "14px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "14px"
      }
    },
    {
      "name": "16",
      "path": "typography.size.16",
      "cssName": "--typography-size-16",
      "value": "16px",
      "resolved": "16px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "16px"
      }
    },
    {
      "name": "18",
      "path": "typography.size.18",
      "cssName": "--typography-size-18",
      "value": "18px",
      "resolved": "18px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "18px"
      }
    },
    {
      "name": "20",
      "path": "typography.size.20",
      "cssName": "--typography-size-20",
      "value": "20px",
      "resolved": "20px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "20px"
      }
    },
    {
      "name": "24",
      "path": "typography.size.24",
      "cssName": "--typography-size-24",
      "value": "24px",
      "resolved": "24px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "24px"
      }
    },
    {
      "name": "32",
      "path": "typography.size.32",
      "cssName": "--typography-size-32",
      "value": "32px",
      "resolved": "32px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "32px"
      }
    },
    {
      "name": "40",
      "path": "typography.size.40",
      "cssName": "--typography-size-40",
      "value": "40px",
      "resolved": "40px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "40px"
      }
    },
    {
      "name": "48",
      "path": "typography.size.48",
      "cssName": "--typography-size-48",
      "value": "48px",
      "resolved": "48px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "48px"
      }
    },
    {
      "name": "64",
      "path": "typography.size.64",
      "cssName": "--typography-size-64",
      "value": "64px",
      "resolved": "64px",
      "description": "",
      "type": "dimension",
      "props": {
        "fontSize": "64px"
      }
    },
    {
      "name": "16",
      "path": "typography.lineHeight.16",
      "cssName": "--typography-lineHeight-16",
      "value": "16px",
      "resolved": "16px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "16px"
      }
    },
    {
      "name": "20",
      "path": "typography.lineHeight.20",
      "cssName": "--typography-lineHeight-20",
      "value": "20px",
      "resolved": "20px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "20px"
      }
    },
    {
      "name": "24",
      "path": "typography.lineHeight.24",
      "cssName": "--typography-lineHeight-24",
      "value": "24px",
      "resolved": "24px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "24px"
      }
    },
    {
      "name": "28",
      "path": "typography.lineHeight.28",
      "cssName": "--typography-lineHeight-28",
      "value": "28px",
      "resolved": "28px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "28px"
      }
    },
    {
      "name": "32",
      "path": "typography.lineHeight.32",
      "cssName": "--typography-lineHeight-32",
      "value": "32px",
      "resolved": "32px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "32px"
      }
    },
    {
      "name": "40",
      "path": "typography.lineHeight.40",
      "cssName": "--typography-lineHeight-40",
      "value": "40px",
      "resolved": "40px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "40px"
      }
    },
    {
      "name": "48",
      "path": "typography.lineHeight.48",
      "cssName": "--typography-lineHeight-48",
      "value": "48px",
      "resolved": "48px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "48px"
      }
    },
    {
      "name": "56",
      "path": "typography.lineHeight.56",
      "cssName": "--typography-lineHeight-56",
      "value": "56px",
      "resolved": "56px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "56px"
      }
    },
    {
      "name": "72",
      "path": "typography.lineHeight.72",
      "cssName": "--typography-lineHeight-72",
      "value": "72px",
      "resolved": "72px",
      "description": "",
      "type": "dimension",
      "props": {
        "lineHeight": "72px"
      }
    }
  ],
  "labels": [
    {
      "name": "normal",
      "path": "typography.letterSpacing.normal",
      "cssName": "--typography-letterSpacing-normal",
      "value": "0px",
      "resolved": "0px",
      "description": "",
      "type": "dimension",
      "props": {
        "letterSpacing": "0px",
        "fontSize": "16px"
      }
    },
    {
      "name": "snug",
      "path": "typography.letterSpacing.snug",
      "cssName": "--typography-letterSpacing-snug",
      "value": "-0.25px",
      "resolved": "-0.25px",
      "description": "",
      "type": "dimension",
      "props": {
        "letterSpacing": "-0.25px",
        "fontSize": "16px"
      }
    },
    {
      "name": "tight",
      "path": "typography.letterSpacing.tight",
      "cssName": "--typography-letterSpacing-tight",
      "value": "-1px",
      "resolved": "-1px",
      "description": "",
      "type": "dimension",
      "props": {
        "letterSpacing": "-1px",
        "fontSize": "16px"
      }
    },
    {
      "name": "tighter",
      "path": "typography.letterSpacing.tighter",
      "cssName": "--typography-letterSpacing-tighter",
      "value": "-0.5px",
      "resolved": "-0.5px",
      "description": "",
      "type": "dimension",
      "props": {
        "letterSpacing": "-0.5px",
        "fontSize": "16px"
      }
    }
  ]
};

function TypePage({ title, items }) {
  return (
    <div className="ds-page">
      <header className="ds-header">
        <div className="ds-header-row"><h1 className="ds-title">{title}</h1><span className="ds-count">{items.length} styles</span></div>
        <p className="ds-subtitle">Rendu live avec les valeurs typographiques réellement résolues depuis les tokens.</p>
      </header>
      <div className="ds-card ds-type-list">
        {items.map((item) => {
          const s = item.props;
          return (
            <section className="ds-type-item" key={item.path}>
              <span className="ds-type-tag">{item.path}</span>
              <div className="ds-type-sample" style={{ fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing }}>
                The quick brown fox jumps over the lazy dog
              </div>
              <div className="ds-meta">
                <code>size {s.fontSize}</code><code>weight {s.fontWeight}</code><code>line-height {s.lineHeight}</code><code>letter-spacing {s.letterSpacing || '0'}</code>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default { title: 'Design System/Typography' };
export const Headings = () => <TypePage title="Headings" items={TYPOGRAPHY.headings} />;
export const Body = () => <TypePage title="Body" items={TYPOGRAPHY.body} />;
export const Labels = () => <TypePage title="Labels" items={TYPOGRAPHY.labels} />;
