import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LiveEditor, LiveProvider, LiveError, LivePreview } from 'react-live';
import { xmlTagsToMarkdown } from './xmlTagsToMarkdown.js';

const liveEditorScope = { React };

const injectUnifiedPreviewFrame = (codeString) => {
  const cssVarMatch = codeString.match(/const\s+(css|__css|__injectedCss)\s*=/);
  if (!cssVarMatch || /<style>\{(?:css|__css|__injectedCss)\}<\/style>/.test(codeString)) {
    return codeString;
  }

  const cssVarName = cssVarMatch[1];
  return codeString.replace(
    /render\(\s*<Demo\s*\/>\s*\);?/,
    `render(<><style>{${cssVarName}}</style><Demo /></>);`
  );
};

export const normalizeLiveCode = (children) => {
  const codeString = (Array.isArray(children) ? children.join('') : String(children)).replace(/\n$/, '');
  return injectUnifiedPreviewFrame(codeString);
};

export const extractLiveCode = (content) => {
  const markdown = xmlTagsToMarkdown(String(content || ''));
  const match = markdown.match(/```(?:jsx|tsx|js)\s*\r?\n([\s\S]*?)\r?\n```/i);
  return match ? normalizeLiveCode(match[1]) : null;
};

export const LiveMarkdownPreview = ({ content }) => {
  const code = extractLiveCode(content);
  if (!code) return <p>Aperçu indisponible : aucun JSX validé dans tokens-docs.json.</p>;

  return (
    <LiveProvider code={code} scope={liveEditorScope} noInline={true}>
      <LivePreview />
      <LiveError className="zh-live-error" />
    </LiveProvider>
  );
};

const LiveCodeBlock = ({ sourceCode }) => {
  const normalizedCode = normalizeLiveCode(sourceCode);
  const [draftCode, setDraftCode] = useState(normalizedCode);

  useEffect(() => {
    setDraftCode(normalizedCode);
  }, [normalizedCode]);

  return (
    <details open className="zh-live-block">
      <summary className="zh-live-summary">Code interactif</summary>
      <LiveProvider code={draftCode} scope={liveEditorScope} noInline={true}>
        <div className="zh-live-workbench">
          <section className="zh-live-preview-shell" aria-label="Aperçu du composant">
            <div className="zh-live-pane-header">
              <span>Aperçu</span>
              <span className="zh-live-status">Mise à jour instantanée</span>
            </div>
            <div className="zh-live-preview">
              <LivePreview />
            </div>
          </section>

          <section className="zh-live-editor-shell" aria-label="Éditeur JSX">
            <div className="zh-live-pane-header zh-live-pane-header-dark">
              <span>JSX</span>
              <button type="button" className="zh-live-reset" onClick={() => setDraftCode(normalizedCode)}>
                Réinitialiser
              </button>
            </div>
            <LiveEditor className="zh-live-editor" onChange={setDraftCode} />
          </section>
          <LiveError className="zh-live-error" />
        </div>
      </LiveProvider>
    </details>
  );
};

export const LiveMarkdownViewer = ({ content }) => {
  if (!content) return null;

  // Convertir le format XML du workflow n8n en markdown si necessaire
  const normalizedContent = xmlTagsToMarkdown(content);

  return (
    <div className="zh-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');

            if (match) {
              const lang = match[1];

              if (['tsx', 'jsx', 'html', 'js'].includes(lang)) {
                const sourceCode = (Array.isArray(children) ? children.join('') : String(children)).replace(/\n$/, '');
                return <LiveCodeBlock sourceCode={sourceCode} />;
              }

              return (
                <pre className="zh-code-block">
                  <code className={className} {...rest}>{children}</code>
                </pre>
              );
            }

            return (
              <code className="zh-code-inline" {...rest}>
                {children}
              </code>
            );
          }
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};
