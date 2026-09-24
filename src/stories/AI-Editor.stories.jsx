import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createTokenDocsPullRequest, listAIBranches, loadBranchDiff, saveTokenDocs } from '../utils/tokenDocsLoader';
import { LiveMarkdownViewer, LiveMarkdownPreview, normalizeLiveCode } from '../utils/LiveMarkdownViewer';
import { mergeEditableDocSections, parseEditableDocSections } from '../utils/docSections';
import { hasXmlTags, xmlTagsToMarkdown } from '../utils/xmlTagsToMarkdown';
import { splitCodePanes, reassembleCode } from '../utils/CodePanes.jsx';
import { validateComponentMarkdownWithMcp } from '../utils/componentValidation';
import './ds-theme.css';

const isAdmin = import.meta.env.VITE_IS_ADMIN === 'true';

const resolveSections = (diff) => {
  const raw = diff.modified || '';
  const converted = hasXmlTags(raw) ? xmlTagsToMarkdown(raw) : raw;
  const branchSections = parseEditableDocSections(converted);
  const mainSections = diff.original ? parseEditableDocSections(diff.original) : {};

  return {
    description: branchSections.description || mainSections.description || '',
    spec: branchSections.spec || mainSections.spec || '',
    doList: branchSections.doList || mainSections.doList || '',
    dontList: branchSections.dontList || mainSections.dontList || '',
    code: branchSections.code || mainSections.code || '',
  };
};

const isTopLevelComponentPath = (path = '') => /^component\.[^.]+$/.test(path);
const getComponentNameFromPath = (path = '') => path.split('.').at(-1) || '';
const getIconFigmaName = (diff, tokens = {}) => {
  const name = getComponentNameFromPath(diff.path);
  return tokens.component?.[name]?.$figma?.name || diff.modifiedMeta?.figmaMatchedKey || '';
};
const isUtilityIconDiff = (diff, tokens) => /^Icon\//i.test(getIconFigmaName(diff, tokens));
const groupReviewDiffs = (diffs, tokens) => {
  const icons = diffs.filter((diff) => isUtilityIconDiff(diff, tokens));
  let iconsAdded = false;
  return diffs.flatMap((diff) => {
    if (!isUtilityIconDiff(diff, tokens)) return [{ type: 'component', diff }];
    if (iconsAdded) return [];
    iconsAdded = true;
    return [{ type: 'iconLibrary', diffs: icons }];
  });
};

const getBranchReviewLabel = (branchName = '') => {
  const match = branchName.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) {
    return `Review Branch : ${branchName}`;
  }

  const [, year, month, day, hour, minute, second] = match;
  return `Review Branch : ${day}/${month}/${year} ${hour}:${minute}:${second}`;
};

const emptyValidationState = {
  status: 'idle',
  message: '',
  issues: [],
};

const getPreviewWarning = (diff) => diff?.modifiedMeta?.preview?.warning || null;

const scopeReviewVariablesCss = (css) => String(css || '').replace(/:root\s*\{/g, '.do-review-token-scope {');

const ReviewTokenScope = ({ branch, variablesCss, children }) => (
  <div className="do-review-token-scope" data-review-branch={branch}>
    <style>{scopeReviewVariablesCss(variablesCss)}</style>
    {children}
  </div>
);

const PreviewApproximationNotice = ({ warning }) => {
  if (!warning) return null;
  const suggestions = Array.isArray(warning.suggestions) ? warning.suggestions : [];

  return (
    <aside className="zh-figma-review-warning" role="status" aria-live="polite">
      <div className="zh-figma-review-warning-head">
        <strong>{warning.title || 'Aperçu Figma à vérifier'}</strong>
        <span>Revue requise</span>
      </div>
      <p>{warning.message || "Le rendu n'a pas pu être reproduit automatiquement à l'identique."}</p>
      {warning.detail && <p className="zh-figma-review-warning-detail">Cause : {warning.detail}</p>}
      {suggestions.length > 0 && (
        <ul>
          {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      )}
    </aside>
  );
};

const ValidationPanel = ({ validationState }) => {
  if (!validationState || validationState.status === 'idle') {
    return null;
  }

  const palette = {
    loading: {
      background: 'var(--color-bg-secondary, #f8fafc)',
      borderColor: 'var(--color-border-default, #e5e7eb)',
      color: 'var(--color-text-secondary, #475569)',
      title: 'Validation en cours',
    },
    valid: {
      background: 'var(--color-feedback-success-bg, #f0fdf4)',
      borderColor: 'var(--color-feedback-success-border, #bbf7d0)',
      color: 'var(--color-feedback-success-text, #166534)',
      title: 'Validation OK',
    },
    invalid: {
      background: 'var(--color-feedback-error-bg, #fef2f2)',
      borderColor: 'var(--color-feedback-error-border, #fecaca)',
      color: 'var(--color-feedback-error-text, #991b1b)',
      title: 'Validation bloquante',
    },
    error: {
      background: 'var(--color-feedback-warning-bg, #fffbeb)',
      borderColor: 'var(--color-feedback-warning-border, #fcd34d)',
      color: 'var(--color-feedback-warning-text, #92400e)',
      title: 'Validation indisponible',
    },
  };

  const theme = palette[validationState.status] || palette.loading;

  return (
    <div
      className="zh-panel"
      style={{
        padding: 'var(--spacing-md, 16px)',
        background: theme.background,
        borderColor: theme.borderColor,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <strong style={{ color: theme.color, fontSize: '14px' }}>{theme.title}</strong>
        <span style={{ color: theme.color, fontSize: '12px' }}>{validationState.message}</span>
      </div>
      {Array.isArray(validationState.issues) && validationState.issues.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: theme.color, fontSize: '13px', lineHeight: 1.5 }}>
          {validationState.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ComponentReviewPanel = ({ diff, sections: providedSections }) => {
  const sections = providedSections || resolveSections(diff);
  const previewWarning = getPreviewWarning(diff);
  const codeString = sections.code || '';
  const liveCode = codeString ? normalizeLiveCode(codeString) : '';
  const hasCode = liveCode && liveCode.trim().length > 0;
  const hasDescription = sections.description && sections.description.trim().length > 0;
  const hasSpec = sections.spec && sections.spec.trim().length > 0;
  const hasDoDont = sections.doList || sections.dontList;

  return (
    <div className="zh-live-stack" style={{ gap: 'var(--spacing-md, 16px)' }}>
      <PreviewApproximationNotice warning={previewWarning} />
      {hasDescription && (
        <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-sm, 14px)',
              fontWeight: 600,
              marginBottom: 'var(--spacing-sm, 8px)',
              color: 'var(--color-text-primary, #111827)',
            }}
          >
            Description développeur
          </h3>
          <div className="zh-markdown-preview">
            <LiveMarkdownViewer content={sections.description} />
          </div>
        </div>
      )}

      {hasSpec && (
        <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-sm, 14px)',
              fontWeight: 600,
              marginBottom: 'var(--spacing-sm, 8px)',
              color: 'var(--color-text-primary, #111827)',
            }}
          >
            Spec
          </h3>
          <div className="zh-markdown-preview">
            <LiveMarkdownViewer content={sections.spec} />
          </div>
        </div>
      )}

      {hasCode && (
        <LiveMarkdownViewer content={`\`\`\`jsx\n${liveCode}\n\`\`\``} />
      )}

      {hasDoDont && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-sm, 8px)',
          }}
        >
          {sections.doList && (
            <div
              className="zh-panel"
              style={{
                padding: 'var(--spacing-md, 16px)',
                background: 'var(--color-feedback-success-bg, #f0fdf4)',
                borderColor: 'var(--color-feedback-success-border, #bbf7d0)',
              }}
            >
              <h4
                style={{
                  fontSize: 'var(--font-size-sm, 14px)',
                  fontWeight: 600,
                  color: 'var(--color-feedback-success-text, #166534)',
                  marginBottom: 'var(--spacing-xs, 4px)',
                }}
              >
                Do
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: 'var(--font-size-sm, 14px)',
                  color: 'var(--color-text-primary, #111827)',
                  lineHeight: '1.6',
                }}
              >
                {sections.doList
                  .split('\n')
                  .filter(Boolean)
                  .map((item, index) => (
                    <li key={`${item}-${index}`} style={{ marginBottom: '2px' }}>
                      {item}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {sections.dontList && (
            <div
              className="zh-panel"
              style={{
                padding: 'var(--spacing-md, 16px)',
                background: 'var(--color-feedback-error-bg, #fef2f2)',
                borderColor: 'var(--color-feedback-error-border, #fecaca)',
              }}
            >
              <h4
                style={{
                  fontSize: 'var(--font-size-sm, 14px)',
                  fontWeight: 600,
                  color: 'var(--color-feedback-error-text, #991b1b)',
                  marginBottom: 'var(--spacing-xs, 4px)',
                }}
              >
                Don't
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: 'var(--font-size-sm, 14px)',
                  color: 'var(--color-text-primary, #111827)',
                  lineHeight: '1.6',
                }}
              >
                {sections.dontList
                  .split('\n')
                  .filter(Boolean)
                  .map((item, index) => (
                    <li key={`${item}-${index}`} style={{ marginBottom: '2px' }}>
                      {item}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const updateNestedDescription = (root, path, newDescription) => {
  const newRoot = JSON.parse(JSON.stringify(root));
  const keys = path.split('.');
  let current = newRoot;
  for (const key of keys) {
    if (!current[key]) current[key] = {};
    current = current[key];
  }
  current.description = newDescription;
  return newRoot;
};

const Icon = {
  Check: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Cube: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  Palette: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="1.5" />
      <circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
      <path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 2-2v-2a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-10-10z" />
    </svg>
  ),
  Code: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Bell: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Search: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Filter: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Plus: ({ size = 16 } = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

const TEAM = [
  { id: 'tj', name: 'Thibault Jovy', role: 'Design Ops', initials: 'TJ', color: '#4f46e5' },
  { id: 'ai', name: 'AI Reviewer', role: 'Documentation', initials: 'AI', color: '#0891b2' },
  { id: 'ds', name: 'Design System', role: 'Tokens', initials: 'DS', color: '#16a34a' },
  { id: 'dev', name: 'Dev Handoff', role: 'Frontend', initials: 'DV', color: '#ea580c' },
];

const STATUS_META = {
  ready: { label: 'À valider', cls: 'todo' },
  progress: { label: 'En cours', cls: 'progress' },
  empty: { label: 'Sans diff composant', cls: 'neutral' },
  error: { label: 'Bloqué', cls: 'blocked' },
  saved: { label: 'Merged', cls: 'success' },
  tosend: { label: 'À envoyer', cls: 'tosend' },
};

const parseBranchDate = (branchName = '') => {
  const match = branchName.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
};

const formatRelativeDate = (date) => {
  if (!date) return 'date inconnue';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return `il y a ${Math.floor(days / 7)} sem`;
};

const classifyDiff = (diff) => {
  if (isTopLevelComponentPath(diff.path)) return 'component';
  if (/color|palette|semantic/i.test(diff.path)) return 'color';
  if (/typography|spacing|radius|shadow|opacity|style/i.test(diff.path)) return 'style';
  return 'doc';
};

const getReviewTitle = (branchName = '') => {
  const shortName = branchName.replace(/^ai\//, '').replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/, '');
  return shortName
    .split(/[-_/]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || branchName;
};

const buildReviewFromBranch = (branch, result, index) => {
  const date = parseBranchDate(branch.name);
  const allDiffs = result?.diffs || [];
  const componentDiffs = allDiffs.filter((diff) => isTopLevelComponentPath(diff.path)).sort((a, b) => a.path.localeCompare(b.path));
  const tokens = result?.branchTokens || {};
  const reviewItems = groupReviewDiffs(componentDiffs, tokens);
  const counts = allDiffs.reduce(
    (acc, diff) => {
      const type = classifyDiff(diff);
      if (type === 'component' && !isUtilityIconDiff(diff, tokens)) acc.components += 1;
      if (type === 'color') acc.colors += 1;
      if (type === 'style') acc.styles += 1;
      return acc;
    },
    { components: 0, colors: 0, styles: 0 }
  );
  counts.iconLibraries = reviewItems.some((item) => item.type === 'iconLibrary') ? 1 : 0;
  counts.icons = componentDiffs.filter((diff) => isUtilityIconDiff(diff, tokens)).length;
  const codeReady = componentDiffs.filter((diff) => resolveSections(diff).code.trim()).length;

  return {
    id: `R-${String(index + 1).padStart(3, '0')}`,
    branch: branch.name,
    name: getReviewTitle(branch.name),
    label: getBranchReviewLabel(branch.name),
    date,
    author: index % 2 === 0 ? 'ai' : 'ds',
    status: componentDiffs.length === 0 ? 'empty' : codeReady === componentDiffs.length ? 'ready' : 'progress',
    counts,
    diffs: componentDiffs,
    reviewItems,
    allDiffs,
    fullBranchDocs: result?.fullBranchDocs || {},
    tokens,
    variablesCss: result?.branchVariablesCss || '',
    sourceRef: result?.sourceRef || branch.name,
    days: date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)) : null,
  };
};

const Avatar = ({ id = 'tj', size = 26 }) => {
  const user = TEAM.find((member) => member.id === id) || TEAM[0];
  return (
    <span className="do-avatar" style={{ width: size, height: size, background: user.color }}>
      {user.initials}
    </span>
  );
};

const LegacyAIEditor = () => {
  if (!isAdmin) {
    return (
      <div className="zh-page">
        <div className="zh-panel zh-ai-locked">
          <h2 className="zh-ai-locked-title">Accès restreint</h2>
          <p>Cet onglet "Design Ops" est réservé aux administrateurs du Design System.</p>
          <p className="zh-ai-locked-note">
            <em>Note aux devs : Ajoutez VITE_IS_ADMIN=true dans votre .env.local pour y accéder en local.</em>
          </p>
        </div>
      </div>
    );
  }

  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [diffs, setDiffs] = useState([]);
  const [fullBranchDocs, setFullBranchDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [editingPath, setEditingPath] = useState(null);
  const [sourceDescription, setSourceDescription] = useState('');
  const [draftSections, setDraftSections] = useState(parseEditableDocSections(''));
  const [draftCodePanes, setDraftCodePanes] = useState({ html: '', css: '', js: '' });
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationState, setValidationState] = useState(emptyValidationState);

  const loadData = useCallback(async (branch) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const { diffs: newDiffs, fullBranchDocs: fullDocs } = await loadBranchDiff(branch);
      const componentDiffs = newDiffs
        .filter((diff) => isTopLevelComponentPath(diff.path))
        .sort((a, b) => a.path.localeCompare(b.path));
      setDiffs(componentDiffs);
      setFullBranchDocs(fullDocs);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Erreur de chargement des différences.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const aiBranches = await listAIBranches();
        setBranches([
          { name: 'main', label: 'Main (Sélectionnez une branche pour voir les diffs)' },
          ...aiBranches.map((branch) => ({ name: branch.name, label: getBranchReviewLabel(branch.name) })),
        ]);
        await loadData('main');
      } catch (err) {
        setStatusMsg({ type: 'error', text: 'Erreur API GitHub. Vérifiez votre TOKEN.' });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadData]);

  const resetEditor = () => {
    setEditingPath(null);
    setSourceDescription('');
    setDraftSections(parseEditableDocSections(''));
    setDraftCodePanes({ html: '', css: '', js: '' });
    setValidationState(emptyValidationState);
  };

  const handleBranchChange = (event) => {
    const branch = event.target.value;
    setCurrentBranch(branch);
    loadData(branch);
    resetEditor();
  };

  const handleStartEdition = (diff) => {
    const resolved = resolveSections(diff);
    const convertedContent = hasXmlTags(diff.modified) ? xmlTagsToMarkdown(diff.modified) : diff.modified;
    setEditingPath(diff.path);
    setSourceDescription(convertedContent);
    setDraftSections(resolved);
    setDraftCodePanes(splitCodePanes(resolved.code ? normalizeLiveCode(resolved.code) : ''));
    setValidationState(emptyValidationState);
  };

  useEffect(() => {
    if (!editingPath) {
      setValidationState(emptyValidationState);
      return undefined;
    }

    const componentName = getComponentNameFromPath(editingPath);
    const mergedMarkdown = mergeEditableDocSections(sourceDescription, {
      ...draftSections,
      code: reassembleCode(draftCodePanes),
    });

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
        const activeDiff = diffs.find((diff) => diff.path === editingPath);
        const nextValidation = await validateComponentMarkdownWithMcp(componentName, mergedMarkdown, {
          allowVisualApproximation: Boolean(getPreviewWarning(activeDiff)),
        });
        if (!cancelled) {
          setValidationState(nextValidation);
        }
      } catch (err) {
        if (!cancelled) {
          setValidationState({
            status: 'error',
            message: err.message || 'Impossible de joindre le serveur MCP.',
            issues: ['Lancez le serveur local ds-component-mcp pour valider avant sauvegarde.'],
          });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editingPath, sourceDescription, draftSections, draftCodePanes]);

  const saveAndCommit = async () => {
    if (!editingPath) return;
    if (validationState.status !== 'valid') {
      setStatusMsg({ type: 'error', text: 'Le composant doit être valide avant sauvegarde.' });
      return;
    }

    setIsCommitting(true);
    try {
      const mergedCode = reassembleCode(draftCodePanes);
      const nextDescription = mergeEditableDocSections(sourceDescription, {
        ...draftSections,
        code: mergedCode,
      });
      const updatedDocs = updateNestedDescription(fullBranchDocs, editingPath, nextDescription);
      const result = await saveTokenDocs(updatedDocs, currentBranch, `docs: validation admin de ${editingPath}`);

      if (!result.success) {
        throw new Error('Le push GitHub a échoué.');
      }

      setStatusMsg({ type: 'success', text: `Sauvegardé sur ${currentBranch}.` });
      resetEditor();
      await loadData(currentBranch);
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erreur : ${err.message}` });
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="zh-page">
      <div className="zh-header zh-panel">
        <h2 className="zh-ai-title">AI Component Editor (Review Mode)</h2>
        <p className="zh-ai-subtitle">
          Sélectionnez une branche générée par l'IA pour valider les contenus composants avant de les fusionner dans main.
        </p>
        <select value={currentBranch} onChange={handleBranchChange} className="zh-ai-select">
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.label}
            </option>
          ))}
        </select>
      </div>

      {statusMsg && (
        <div className={statusMsg.type === 'error' ? 'zh-ai-alert zh-ai-alert-error' : 'zh-ai-alert zh-ai-alert-success'}>
          {statusMsg.text}
        </div>
      )}

      {loading ? (
        <div className="zh-ai-state">Analyse des différences en cours...</div>
      ) : currentBranch === 'main' ? (
        <div className="zh-ai-state zh-ai-state-muted">
          <h3 className="zh-ai-state-title">Branche principale</h3>
          <p>Basculez sur une branche d'IA pour valider les nouveaux contenus.</p>
        </div>
      ) : diffs.length === 0 ? (
        <div className="zh-ai-state zh-ai-state-success">
          <h3 className="zh-ai-state-title">Tout est à jour</h3>
          <p>Aucun composant différent trouvé entre cette branche et main.</p>
        </div>
      ) : (
        <div className="zh-ai-stack">
          <div className="zh-ai-toolbar">
            <span className="zh-ai-badge">Mode Validation</span>
            <span className="zh-ai-count">{diffs.length} composant(s) à relire</span>
          </div>

          {diffs.map((diff) => {
            const draftPreviewSections =
              editingPath === diff.path
                ? {
                    ...draftSections,
                    code: reassembleCode(draftCodePanes),
                  }
                : null;

            return (
              <div key={diff.path} className="zh-panel">
                <div className="zh-ai-card-head">
                  <strong className="zh-ai-path">{diff.path}</strong>
                  {editingPath !== diff.path && (
                    <button className="zh-edit-btn zh-edit-btn-inline" onClick={() => handleStartEdition(diff)}>
                      Editer
                    </button>
                  )}
                </div>

                {editingPath === diff.path ? (
                  <div className="zh-edit-panel zh-edit-panel-inline">
                    <p className="zh-edit-lock-note">
                      Modification autorisée uniquement sur : description, spec, do, don't et code de dev.
                    </p>
                    <label className="zh-edit-label" htmlFor={`ai-desc-${diff.path}`}>
                      Description développeur
                    </label>
                    <textarea
                      id={`ai-desc-${diff.path}`}
                      className="zh-edit-textarea zh-edit-textarea-md"
                      value={draftSections.description}
                      onChange={(event) => setDraftSections((prev) => ({ ...prev, description: event.target.value }))}
                    />
                    <label className="zh-edit-label" htmlFor={`ai-spec-${diff.path}`}>
                      Spec
                    </label>
                    <textarea
                      id={`ai-spec-${diff.path}`}
                      className="zh-edit-textarea zh-edit-textarea-md"
                      value={draftSections.spec}
                      onChange={(event) => setDraftSections((prev) => ({ ...prev, spec: event.target.value }))}
                    />
                    <div className="zh-edit-grid">
                      <div>
                        <label className="zh-edit-label" htmlFor={`ai-do-${diff.path}`}>
                          Do
                        </label>
                        <textarea
                          id={`ai-do-${diff.path}`}
                          className="zh-edit-textarea zh-edit-textarea-sm"
                          value={draftSections.doList}
                          onChange={(event) => setDraftSections((prev) => ({ ...prev, doList: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="zh-edit-label" htmlFor={`ai-dont-${diff.path}`}>
                          Don't
                        </label>
                        <textarea
                          id={`ai-dont-${diff.path}`}
                          className="zh-edit-textarea zh-edit-textarea-sm"
                          value={draftSections.dontList}
                          onChange={(event) => setDraftSections((prev) => ({ ...prev, dontList: event.target.value }))}
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
                          htmlFor={`ai-html-${diff.path}`}
                          style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          HTML
                        </label>
                        <textarea
                          id={`ai-html-${diff.path}`}
                          className="zh-edit-textarea zh-edit-textarea-lg"
                          style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
                          value={draftCodePanes.html}
                          onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, html: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label
                          className="zh-edit-label"
                          htmlFor={`ai-css-${diff.path}`}
                          style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          CSS
                        </label>
                        <textarea
                          id={`ai-css-${diff.path}`}
                          className="zh-edit-textarea zh-edit-textarea-lg"
                          style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
                          value={draftCodePanes.css}
                          onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, css: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label
                          className="zh-edit-label"
                          htmlFor={`ai-js-${diff.path}`}
                          style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        >
                          JSX
                        </label>
                        <textarea
                          id={`ai-js-${diff.path}`}
                          className="zh-edit-textarea zh-edit-textarea-lg"
                          style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
                          value={draftCodePanes.js}
                          onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, js: event.target.value }))}
                        />
                      </div>
                    </div>
                    <ValidationPanel validationState={validationState} />
                    <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)' }}>
                      <div className="zh-ai-card-head" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
                        <strong className="zh-ai-path">Aperçu mis à jour</strong>
                      </div>
                      <ComponentReviewPanel sections={draftPreviewSections} />
                    </div>
                    <div className="zh-edit-actions">
                      <button
                        className="zh-btn-primary"
                        onClick={saveAndCommit}
                        disabled={isCommitting || validationState.status !== 'valid'}
                      >
                        {isCommitting ? 'Sauvegarde...' : 'Valider & Sauvegarder'}
                      </button>
                      <button className="zh-btn-secondary" onClick={resetEditor}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <ComponentReviewPanel diff={diff} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AIEditor = () => {
  if (!isAdmin) {
    return (
      <div className="do-shell">
        <div className="do-content">
          <div className="do-card" style={{ padding: 32 }}>
            <h2 className="do-page-title">Accès restreint</h2>
            <p className="do-page-sub">Cet onglet Design Ops est réservé aux administrateurs du Design System.</p>
            <p className="do-page-sub">
              Ajoutez <code>VITE_IS_ADMIN=true</code> dans votre <code>.env.local</code> pour y accéder en local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [reviews, setReviews] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [editingPath, setEditingPath] = useState(null);
  const [sourceDescription, setSourceDescription] = useState('');
  const [draftSections, setDraftSections] = useState(parseEditableDocSections(''));
  const [draftCodePanes, setDraftCodePanes] = useState({ html: '', css: '', js: '' });
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [validationState, setValidationState] = useState(emptyValidationState);

  const selectedReview = useMemo(
    () => reviews.find((review) => review.branch === selectedBranch) || null,
    [reviews, selectedBranch]
  );

  const resetEditor = useCallback(() => {
    setEditingPath(null);
    setSourceDescription('');
    setDraftSections(parseEditableDocSections(''));
    setDraftCodePanes({ html: '', css: '', js: '' });
    setValidationState(emptyValidationState);
  }, []);

  const loadReviews = useCallback(async (preferredBranch) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const aiBranches = await listAIBranches();
      const loadedReviews = await Promise.all(
        aiBranches.map(async (branch, index) => {
          try {
            const result = await loadBranchDiff(branch.name, branch.sourceRef);
            return buildReviewFromBranch(branch, result, index);
          } catch (err) {
            return {
              id: `R-${String(index + 1).padStart(3, '0')}`,
              branch: branch.name,
              name: getReviewTitle(branch.name),
              label: getBranchReviewLabel(branch.name),
              date: parseBranchDate(branch.name),
              author: 'ai',
              status: 'error',
              counts: { components: 0, iconLibraries: 0, icons: 0, colors: 0, styles: 0 },
              diffs: [],
              reviewItems: [],
              allDiffs: [],
              fullBranchDocs: {},
            };
          }
        })
      );

      setReviews(loadedReviews);
      setSelectedBranch((previous) => {
        if (preferredBranch && loadedReviews.some((review) => review.branch === preferredBranch)) return preferredBranch;
        if (previous && loadedReviews.some((review) => review.branch === previous)) return previous;
        return loadedReviews[0]?.branch || null;
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Erreur API GitHub. Vérifiez le token et le repo configurés.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const kpis = useMemo(() => {
    const totals = reviews.reduce(
      (acc, review) => {
        acc.components += review.counts.components + review.counts.iconLibraries;
        acc.styles += review.counts.colors + review.counts.styles;
        acc.ready += review.status === 'ready' ? 1 : 0;
        acc.blocked += review.status === 'error' ? 1 : 0;
        return acc;
      },
      { components: 0, styles: 0, ready: 0, blocked: 0 }
    );

    return [
      { id: 'all', label: 'Reviews à valider', value: reviews.length, delta: reviews.length, icon: 'Check', priority: true },
      { id: 'components', label: 'Composants et librairies à vérifier', value: totals.components, delta: totals.components, icon: 'Cube' },
      { id: 'styles', label: 'Couleurs/Styles à valider', value: totals.styles, delta: totals.styles, icon: 'Palette' },
      { id: 'ready', label: 'Ready to dev', value: totals.ready, delta: totals.ready - totals.blocked, icon: 'Code' },
    ];
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesSearch = !normalizedSearch || `${review.name} ${review.id} ${review.branch}`.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'components' && review.counts.components + review.counts.iconLibraries > 0) ||
        (filter === 'styles' && review.counts.colors + review.counts.styles > 0) ||
        (filter === 'ready' && review.status === 'ready') ||
        review.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [reviews, search, filter]);

  const handleSelectReview = (review) => {
    setSelectedBranch(review.branch);
    resetEditor();
  };

  const handleStartEdition = (diff) => {
    const resolved = resolveSections(diff);
    const convertedContent = hasXmlTags(diff.modified) ? xmlTagsToMarkdown(diff.modified) : diff.modified;
    setEditingPath(diff.path);
    setSourceDescription(convertedContent);
    setDraftSections(resolved);
    setDraftCodePanes(splitCodePanes(resolved.code ? normalizeLiveCode(resolved.code) : ''));
    setValidationState(emptyValidationState);
  };

  useEffect(() => {
    if (!editingPath) {
      setValidationState(emptyValidationState);
      return undefined;
    }

    const componentName = getComponentNameFromPath(editingPath);
    const mergedMarkdown = mergeEditableDocSections(sourceDescription, {
      ...draftSections,
      code: reassembleCode(draftCodePanes),
    });

    let cancelled = false;
    setValidationState((prev) => ({
      status: 'loading',
      message: prev.status === 'valid' || prev.status === 'invalid' ? prev.message : 'Validation MCP en cours...',
      issues: prev.status === 'valid' ? [] : prev.issues || [],
    }));

    const timer = setTimeout(async () => {
      try {
        const activeDiff = selectedReview?.diffs.find((diff) => diff.path === editingPath);
        const nextValidation = await validateComponentMarkdownWithMcp(componentName, mergedMarkdown, {
          allowVisualApproximation: Boolean(getPreviewWarning(activeDiff)),
          tokens: selectedReview?.tokens,
          sourceRef: selectedReview?.sourceRef,
        });
        if (!cancelled) setValidationState(nextValidation);
      } catch (err) {
        if (!cancelled) {
          setValidationState({
            status: 'error',
            message: err.message || 'Impossible de joindre le serveur MCP.',
            issues: ['Lancez le serveur local ds-component-mcp pour valider avant sauvegarde.'],
          });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [editingPath, sourceDescription, draftSections, draftCodePanes]);

  const saveEdits = async () => {
    if (!editingPath || !selectedReview) return;
    if (validationState.status !== 'valid') {
      setStatusMsg({ type: 'error', text: 'Le composant doit être valide avant sauvegarde.' });
      return;
    }

    setIsCommitting(true);
    try {
      const mergedCode = reassembleCode(draftCodePanes);
      const nextDescription = mergeEditableDocSections(sourceDescription, {
        ...draftSections,
        code: mergedCode,
      });
      const updatedDocs = updateNestedDescription(selectedReview.fullBranchDocs, editingPath, nextDescription);
      const result = await saveTokenDocs(updatedDocs, selectedReview.branch, `docs: update review for ${editingPath}`);

      if (!result.success) throw new Error(result.error || 'Le push GitHub a échoué.');

      setStatusMsg({ type: 'success', text: `Sauvegardé sur ${selectedReview.branch}.` });
      resetEditor();
      await loadReviews(selectedReview.branch);
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erreur : ${err.message}` });
    } finally {
      setIsCommitting(false);
    }
  };

  const validateAndCreatePullRequest = async () => {
    if (!selectedReview || editingPath) {
      setStatusMsg({ type: 'error', text: "Enregistrez ou annulez l'édition avant de créer la PR." });
      return;
    }
    if (!selectedReview.diffs.length) {
      setStatusMsg({ type: 'error', text: 'Aucun composant modifié à proposer.' });
      return;
    }

    setIsCreatingPr(true);
    setStatusMsg({ type: 'info', text: `Validation MCP de ${selectedReview.diffs.length} composant(s)...` });
    try {
      const validations = await Promise.all(
        selectedReview.diffs.map(async (diff) => ({
          path: diff.path,
          result: await validateComponentMarkdownWithMcp(getComponentNameFromPath(diff.path), diff.modified, {
            allowVisualApproximation: Boolean(getPreviewWarning(diff)),
            tokens: selectedReview.tokens,
            sourceRef: selectedReview.sourceRef,
          }),
        }))
      );
      const invalid = validations.filter(({ result }) => result.status !== 'valid');
      if (invalid.length) {
        const names = invalid.map(({ path }) => path).join(', ');
        throw new Error(`Validation MCP bloquante pour : ${names}`);
      }

      const componentNames = selectedReview.diffs.map((diff) => getComponentNameFromPath(diff.path));
      const result = await createTokenDocsPullRequest(
        selectedReview.branch,
        `docs: ${componentNames.join(', ')}`,
        [
          'Documentation composant validee depuis Storybook.',
          '',
          `Composants: ${componentNames.join(', ')}`,
          'Source visuelle: Figma. Source des styles: variables.css genere depuis tokens.json.',
          'Fichier modifie par le workflow: tokens-docs.json.',
        ].join('\n')
      );
      if (!result.success) throw new Error(result.error || 'La création de PR a échoué.');
      setStatusMsg({
        type: 'success',
        text: result.existing ? `PR #${result.number} déjà ouverte.` : `PR #${result.number} créée.`,
        url: result.url,
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Erreur : ${err.message}` });
    } finally {
      setIsCreatingPr(false);
    }
  };

  return (
    <div className="do-shell">
      <main className="do-main">
        <header className="do-home-header">
          <div>
            <h1 className="do-home-title">
              <span>Thibault</span>Jovy <em>Design System</em>
            </h1>
            <p>Revue et publication des composants</p>
          </div>
          <div className="do-home-tools">
            <button className="do-icon-btn" type="button" aria-label="Notifications">
              <Icon.Bell />
              {reviews.length > 0 && <span className="do-dot" />}
            </button>
            <Avatar id="tj" size={32} />
          </div>
        </header>

        <div className="do-content">
          {statusMsg && (
            <div className={statusMsg.type === 'error' ? 'zh-ai-alert zh-ai-alert-error' : 'zh-ai-alert zh-ai-alert-success'}>
              <span>{statusMsg.text}</span>
              {statusMsg.url && <a href={statusMsg.url} target="_blank" rel="noreferrer">Ouvrir la PR</a>}
            </div>
          )}

          <div className="do-kpi-grid">
            {kpis.map((kpi) => {
              const KpiIcon = Icon[kpi.icon];
              const active = filter === kpi.id || (kpi.id === 'all' && filter === 'all');
              return (
                <button
                  className={`do-kpi ${active ? 'active' : ''} ${kpi.priority ? 'priority' : ''}`}
                  key={kpi.id}
                  type="button"
                  onClick={() => setFilter(kpi.id)}
                >
                  <div className="do-kpi-top">
                    <span className="do-kpi-icon"><KpiIcon /></span>
                    <span className={`do-kpi-trend ${kpi.delta >= 0 ? 'up' : 'down'}`}>{kpi.delta >= 0 ? '↗' : '↘'}</span>
                  </div>
                  <div>
                    <div className="do-kpi-num">{loading ? '...' : kpi.value}</div>
                    <div className="do-kpi-label">{kpi.label}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="do-card do-home-card">
            <div className="do-card-head">
              <h2 className="do-card-title">
                Reviews à valider
              </h2>
              <div className="do-card-actions">
                <button className="do-btn" type="button" onClick={() => setFilter(filter === 'all' ? 'ready' : 'all')}>
                  <Icon.Filter size={13} /> Filtrer
                </button>
              </div>
            </div>
            <div className="do-home-searchbar">
              <label className="do-search">
                <Icon.Search size={13} />
                <input
                  placeholder="Rechercher une review ou un auteur..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>

            <table className="do-table">
              <thead>
                <tr>
                  <th>Nom de la review</th>
                  <th>Date de soumission</th>
                  <th>Auteur</th>
                  <th>Éléments</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="6" className="empty">Chargement des reviews GitHub...</td></tr>
                )}
                {!loading && filteredReviews.length === 0 && (
                  <tr><td colSpan="6" className="empty">Aucune review ne correspond au filtre.</td></tr>
                )}
                {!loading && filteredReviews.map((review) => {
                  const status = STATUS_META[review.status] || STATUS_META.progress;
                  const selected = selectedReview?.branch === review.branch;
                  return (
                    <tr key={review.branch} className={selected ? 'selected' : ''}>
                      <td>
                        <span className="do-review-name">
                          {review.name}
                        </span>
                      </td>
                      <td>
                        {formatRelativeDate(review.date)}
                      </td>
                      <td><span className="do-author"><Avatar id={review.author} size={22} />{TEAM.find((member) => member.id === review.author)?.name}</span></td>
                      <td>
                        <span className="do-elts">
                          {review.counts.components > 0 && <span className="do-elt c">{review.counts.components} composants</span>}
                          {review.counts.iconLibraries > 0 && <span className="do-elt c">Utility Icons · {review.counts.icons} icônes</span>}
                          {review.counts.colors > 0 && <span className="do-elt k">{review.counts.colors} couleurs</span>}
                          {review.counts.styles > 0 && <span className="do-elt s">{review.counts.styles} styles</span>}
                          {review.allDiffs.length === 0 && <span className="do-elt s">0 diff</span>}
                        </span>
                      </td>
                      <td><span className={`do-badge ${status.cls}`}>{status.label}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="do-row-action primary" type="button" onClick={() => handleSelectReview(review)}>
                          {selected ? 'Ouverte' : 'Consulter'} ›
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="do-pager">
              <span>Affichage de {filteredReviews.length} reviews</span>
              <span className="do-pages">
                <button className="do-page" type="button">Précédent</button>
                <button className="do-page" type="button">Suivant</button>
              </span>
            </div>
          </div>

          {selectedReview && (
            <ReviewTokenScope branch={selectedReview.branch} variablesCss={selectedReview.variablesCss}>
            <section className="do-stack do-review-detail">
              <div className="do-card do-review-summary">
                <div className="do-card-head">
                  <div>
                    <div className="do-card-title" style={{ marginBottom: 8 }}>
                      <span className="do-card-title-text">Validation de {selectedReview.name}</span>
                      <span className="do-title-count">{selectedReview.counts.components} composant(s) · {selectedReview.counts.iconLibraries} librairie(s) d’icônes</span>
                    </div>
                    <div className="do-page-sub">{selectedReview.label}</div>
                  </div>
                  <div className="do-card-actions">
                    <button className="do-btn" type="button" onClick={() => loadReviews(selectedReview.branch)}>
                      <Icon.Filter size={13} /> Actualiser
                    </button>
                    <button className="do-btn" type="button" onClick={resetEditor}>
                      Fermer l'édition
                    </button>
                    <button
                      className="do-btn primary"
                      type="button"
                      onClick={validateAndCreatePullRequest}
                      disabled={isCreatingPr || Boolean(editingPath) || selectedReview.diffs.length === 0}
                    >
                      {isCreatingPr ? 'Validation...' : 'Valider et créer la PR'}
                    </button>
                  </div>
                </div>
              </div>

              {selectedReview.diffs.length === 0 ? (
                <div className="zh-ai-state zh-ai-state-muted">Aucun composant top-level à relire dans cette branche.</div>
              ) : (
                selectedReview.reviewItems.map((item) => {
                  const renderDiff = (diff, isIcon = false) => {
                  const draftPreviewSections = editingPath === diff.path ? { ...draftSections, code: reassembleCode(draftCodePanes) } : null;

                  return (
                    <div key={`${selectedReview.branch}-${diff.path}`} className={isIcon ? `zh-panel do-icon-review-card${editingPath === diff.path ? ' is-editing' : ''}` : 'zh-panel'}>
                      <div className="zh-ai-card-head">
                        <div className="zh-ai-card-title-wrap">
                          <strong className="zh-ai-path">{isIcon ? getIconFigmaName(diff, selectedReview.tokens).replace(/^Icon\//i, '') : diff.path}</strong>
                          {getPreviewWarning(diff) && <span className="zh-figma-review-warning-badge">Aperçu à vérifier</span>}
                        </div>
                        {editingPath !== diff.path && (
                          <button className="zh-edit-btn zh-edit-btn-inline" type="button" onClick={() => handleStartEdition(diff)}>
                            Editer
                          </button>
                        )}
                      </div>
                      {isIcon && (
                        <div className="do-icon-review-preview">
                          <LiveMarkdownPreview content={diff.modified} />
                        </div>
                      )}

                      {editingPath === diff.path ? (
                        <div className="zh-edit-panel zh-edit-panel-inline">
                          <p className="zh-edit-lock-note">
                            Modification autorisée uniquement sur : description, spec, do, don't et code de dev.
                          </p>
                          <label className="zh-edit-label" htmlFor={`ai-desc-${diff.path}`}>Description développeur</label>
                          <textarea
                            id={`ai-desc-${diff.path}`}
                            className="zh-edit-textarea zh-edit-textarea-md"
                            value={draftSections.description}
                            onChange={(event) => setDraftSections((prev) => ({ ...prev, description: event.target.value }))}
                          />
                          <label className="zh-edit-label" htmlFor={`ai-spec-${diff.path}`}>Spec</label>
                          <textarea
                            id={`ai-spec-${diff.path}`}
                            className="zh-edit-textarea zh-edit-textarea-md"
                            value={draftSections.spec}
                            onChange={(event) => setDraftSections((prev) => ({ ...prev, spec: event.target.value }))}
                          />
                          <div className="zh-edit-grid">
                            <div>
                              <label className="zh-edit-label" htmlFor={`ai-do-${diff.path}`}>Do</label>
                              <textarea
                                id={`ai-do-${diff.path}`}
                                className="zh-edit-textarea zh-edit-textarea-sm"
                                value={draftSections.doList}
                                onChange={(event) => setDraftSections((prev) => ({ ...prev, doList: event.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="zh-edit-label" htmlFor={`ai-dont-${diff.path}`}>Don't</label>
                              <textarea
                                id={`ai-dont-${diff.path}`}
                                className="zh-edit-textarea zh-edit-textarea-sm"
                                value={draftSections.dontList}
                                onChange={(event) => setDraftSections((prev) => ({ ...prev, dontList: event.target.value }))}
                              />
                            </div>
                          </div>
                          <label className="zh-edit-label">Code interactif</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-sm, 8px)' }}>
                            {[
                              ['html', 'HTML'],
                              ['css', 'CSS'],
                              ['js', 'JSX'],
                            ].map(([key, label]) => (
                              <div key={key}>
                                <label className="zh-edit-label" htmlFor={`ai-${key}-${diff.path}`} style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {label}
                                </label>
                                <textarea
                                  id={`ai-${key}-${diff.path}`}
                                  className="zh-edit-textarea zh-edit-textarea-lg"
                                  style={{ fontFamily: 'var(--font-family-code, monospace)', fontSize: '12px' }}
                                  value={draftCodePanes[key]}
                                  onChange={(event) => setDraftCodePanes((prev) => ({ ...prev, [key]: event.target.value }))}
                                />
                              </div>
                            ))}
                          </div>
                          <ValidationPanel validationState={validationState} />
                          <div className="zh-panel" style={{ padding: 'var(--spacing-md, 16px)' }}>
                            <div className="zh-ai-card-head" style={{ marginBottom: 'var(--spacing-sm, 8px)' }}>
                              <strong className="zh-ai-path">Aperçu mis à jour</strong>
                            </div>
                            <ComponentReviewPanel diff={diff} sections={draftPreviewSections} />
                          </div>
                          <div className="zh-edit-actions">
                            <button className="zh-btn-primary" type="button" onClick={saveEdits} disabled={isCommitting || validationState.status !== 'valid'}>
                              {isCommitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                            </button>
                            <button className="zh-btn-secondary" type="button" onClick={resetEditor}>Annuler</button>
                          </div>
                        </div>
                      ) : isIcon ? (
                        <details className="do-icon-review-details">
                          <summary>Spécifications et code · {diff.path}</summary>
                          <ComponentReviewPanel diff={diff} />
                        </details>
                      ) : (
                        <ComponentReviewPanel diff={diff} />
                      )}
                    </div>
                  );
                  };

                  if (item.type === 'iconLibrary') {
                    return (
                      <section key={`${selectedReview.branch}-utility-icons`} className="zh-panel do-icon-review-library" aria-labelledby="do-utility-icons-title">
                        <header className="do-icon-review-heading">
                          <h2 id="do-utility-icons-title">Utility Icons</h2>
                          <span className="do-title-count">{item.diffs.length} icône(s)</span>
                        </header>
                        <p>Une seule librairie à relire. Chaque icône conserve sa documentation et sa validation individuelles.</p>
                        <div className="do-icon-review-grid">{item.diffs.map((diff) => renderDiff(diff, true))}</div>
                      </section>
                    );
                  }
                  return renderDiff(item.diff);
                })
              )}
            </section>
            </ReviewTokenScope>
          )}
        </div>
      </main>
    </div>
  );
};

export default {
  title: 'Design Ops/AI Token Editor',
  component: AIEditor,
};

export const Editor = () => <AIEditor />;
