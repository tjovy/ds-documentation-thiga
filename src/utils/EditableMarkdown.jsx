import React, { useState, useEffect } from 'react';
import { saveTokenDocs } from './tokenDocsLoader';
import { LiveMarkdownViewer, normalizeLiveCode } from './LiveMarkdownViewer';
import { mergeEditableDocSections, parseEditableDocSections } from './docSections';
import { splitCodePanes, reassembleCode } from './CodePanes.jsx';
import { validateComponentMarkdownWithMcp } from './componentValidation';

const emptyValidationState = {
  status: 'idle',
  message: '',
  issues: [],
};

const getFallbackDescription = (markdown = '') => {
  const raw = String(markdown).replace(/```[\s\S]*?```/g, '').replace(/^#\s+.*$/m, '');
  const firstBlock = raw.split(/\n##\s+/)[0] || '';
  const lines = firstBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('✅') && !line.startsWith('❌') && !line.startsWith('-'));
  return lines.join(' ').trim();
};

export const EditableMarkdown = ({ tokenPath, initialDescription = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [sourceContent, setSourceContent] = useState(initialDescription);
  const [sections, setSections] = useState(parseEditableDocSections(initialDescription));
  const [draftCodePanes, setDraftCodePanes] = useState({ html: '', css: '', js: '' });
  const [saving, setSaving] = useState(false);
  const [validationState, setValidationState] = useState(emptyValidationState);

  const isAdmin = import.meta.env.VITE_IS_ADMIN === 'true';
  const isComponentDoc = tokenPath.startsWith('component.');

  useEffect(() => {
    setSourceContent(initialDescription);
    setSections(parseEditableDocSections(initialDescription));
  }, [initialDescription]);

  useEffect(() => {
    if (!isEditing || !isComponentDoc) {
      setValidationState(emptyValidationState);
      return undefined;
    }

    const markdown = mergeEditableDocSections(sourceContent, {
      ...sections,
      code: reassembleCode(draftCodePanes),
    });
    const componentName = tokenPath.split('.').at(-1) || '';

    let cancelled = false;
    setValidationState((prev) => ({
      status: 'loading',
      message:
        prev.status === 'valid' || prev.status === 'invalid'
          ? prev.message
          : 'Validation MCP en cours...',
      issues: prev.status === 'valid' ? [] : prev.issues || [],
    }));

    const timer = setTimeout(async () => {
      try {
        const nextValidation = await validateComponentMarkdownWithMcp(componentName, markdown);
        if (!cancelled) {
          setValidationState(nextValidation);
        }
      } catch (err) {
        if (!cancelled) {
          setValidationState({
            status: 'error',
            message: err.message || 'Impossible de joindre le serveur MCP.',
            issues: ['Lancez le serveur local ds-component-mcp pour activer la validation.'],
          });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isEditing, isComponentDoc, sourceContent, sections, draftCodePanes, tokenPath]);

  const resetEditor = () => {
    setIsEditing(false);
    setDraftCodePanes({ html: '', css: '', js: '' });
    setValidationState(emptyValidationState);
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    const parsed = parseEditableDocSections(sourceContent);
    setSections(parsed);
    setDraftCodePanes(splitCodePanes(parsed.code ? normalizeLiveCode(parsed.code) : ''));
    setValidationState(emptyValidationState);
  };

  const handleSave = async () => {
    if (isComponentDoc && validationState.status !== 'valid') {
      alert('La documentation composant doit etre validee par le MCP avant publication.');
      return;
    }

    setSaving(true);
    const mergedCode = reassembleCode(draftCodePanes);
    const content = mergeEditableDocSections(sourceContent, { ...sections, code: mergedCode });
    const keys = tokenPath.split('.');
    const newDoc = {};
    let current = newDoc;
    for (let index = 0; index < keys.length - 1; index += 1) {
      current[keys[index]] = {};
      current = current[keys[index]];
    }
    current[keys[keys.length - 1]] = { description: content };

    const result = await saveTokenDocs(newDoc, 'main', `docs: update ${tokenPath}`);
    setSaving(false);
    if (result.success) {
      setSourceContent(content);
      resetEditor();
      return;
    }

    alert(`Erreur : ${result.error}`);
  };

  if (isEditing) {
    const draftPreviewContent = mergeEditableDocSections(sourceContent, {
      ...sections,
      code: reassembleCode(draftCodePanes),
    });

    return (
      <div className="zh-edit-panel">
        <div className="zh-edit-header">Édition de : {tokenPath}</div>
        <p className="zh-edit-lock-note">
          Modification autorisée uniquement sur : description, spec, do, don't et code de dev.
        </p>
        <label className="zh-edit-label" htmlFor={`desc-${tokenPath}`}>
          Description développeur
        </label>
        <textarea
          id={`desc-${tokenPath}`}
          className="zh-edit-textarea zh-edit-textarea-md"
          value={sections.description}
          onChange={(event) => setSections((prev) => ({ ...prev, description: event.target.value }))}
        />
        <label className="zh-edit-label" htmlFor={`spec-${tokenPath}`}>
          Spec
        </label>
        <textarea
          id={`spec-${tokenPath}`}
          className="zh-edit-textarea zh-edit-textarea-md"
          value={sections.spec}
          onChange={(event) => setSections((prev) => ({ ...prev, spec: event.target.value }))}
        />
        <div className="zh-edit-grid">
          <div>
            <label className="zh-edit-label" htmlFor={`do-${tokenPath}`}>
              Do
            </label>
            <textarea
              id={`do-${tokenPath}`}
              className="zh-edit-textarea zh-edit-textarea-sm"
              value={sections.doList}
              onChange={(event) => setSections((prev) => ({ ...prev, doList: event.target.value }))}
            />
          </div>
          <div>
            <label className="zh-edit-label" htmlFor={`dont-${tokenPath}`}>
              Don't
            </label>
            <textarea
              id={`dont-${tokenPath}`}
              className="zh-edit-textarea zh-edit-textarea-sm"
              value={sections.dontList}
              onChange={(event) => setSections((prev) => ({ ...prev, dontList: event.target.value }))}
            />
          </div>
        </div>
        <label className="zh-edit-label">Code interactif</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'var(--spacing-sm, 8px)',
          }}
        >
          <div>
            <label
              className="zh-edit-label"
              htmlFor={`html-${tokenPath}`}
              style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              HTML
            </label>
            <textarea
              id={`html-${tokenPath}`}
              className="zh-edit-textarea zh-edit-textarea-lg"
              style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
              value={draftCodePanes.html}
              onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, html: event.target.value }))}
            />
          </div>
          <div>
            <label
              className="zh-edit-label"
              htmlFor={`css-${tokenPath}`}
              style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              CSS
            </label>
            <textarea
              id={`css-${tokenPath}`}
              className="zh-edit-textarea zh-edit-textarea-lg"
              style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
              value={draftCodePanes.css}
              onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, css: event.target.value }))}
            />
          </div>
          <div>
            <label
              className="zh-edit-label"
              htmlFor={`js-${tokenPath}`}
              style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              JSX
            </label>
            <textarea
              id={`js-${tokenPath}`}
              className="zh-edit-textarea zh-edit-textarea-lg"
              style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
              value={draftCodePanes.js}
              onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, js: event.target.value }))}
            />
          </div>
        </div>
        {isComponentDoc && (
          <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)', marginTop: 'var(--spacing-md, 16px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <strong style={{ fontSize: '14px' }}>Validation</strong>
              <span style={{ fontSize: '12px' }}>{validationState.message}</span>
            </div>
            {Array.isArray(validationState.issues) && validationState.issues.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.5 }}>
                {validationState.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {isComponentDoc && (
          <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)', marginTop: 'var(--spacing-md, 16px)' }}>
            <div className="zh-ai-card-head" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
              <strong className="zh-ai-path">{tokenPath}</strong>
            </div>
            <LiveMarkdownViewer content={draftPreviewContent} />
          </div>
        )}
        <div className="zh-edit-actions">
          <button
            className="zh-btn-primary"
            onClick={handleSave}
            disabled={saving || (isComponentDoc && validationState.status !== 'valid')}
          >
            {saving ? 'Sauvegarde...' : 'Publier'}
          </button>
          <button className="zh-btn-secondary" onClick={resetEditor}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  const previewSections = parseEditableDocSections(sourceContent);
  const fallbackTitle = tokenPath.split('.').at(-1)?.replace(/^\w/, (char) => char.toUpperCase()) || 'Component';
  const descriptionText = previewSections.description || getFallbackDescription(sourceContent) || 'À compléter.';
  const componentSource = sourceContent || `# ${fallbackTitle} Component`;
  const componentPreviewContent = mergeEditableDocSections(componentSource, {
    description: descriptionText,
    spec: previewSections.spec,
    doList: previewSections.doList,
    dontList: previewSections.dontList,
    code: previewSections.code,
  });

  return (
    <div className="zh-editable-wrapper">
      {!isComponentDoc && isAdmin && (
        <button className="zh-edit-btn" onClick={handleStartEditing}>
          Editer
        </button>
      )}
      {!isComponentDoc && !sourceContent && <div className="zh-empty">Aucune documentation pour {tokenPath}.</div>}
      {!isComponentDoc && sourceContent && <LiveMarkdownViewer content={sourceContent} />}
      {isComponentDoc && (
        <div className="zh-panel">
          <div className="zh-ai-card-head">
            <strong className="zh-ai-path">{tokenPath}</strong>
            {isAdmin && (
              <button className="zh-edit-btn zh-edit-btn-inline" onClick={handleStartEditing}>
                Editer
              </button>
            )}
          </div>
          <div className="zh-markdown-preview">
            <LiveMarkdownViewer content={componentPreviewContent} />
          </div>
        </div>
      )}
    </div>
  );
};
