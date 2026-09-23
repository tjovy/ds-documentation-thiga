// src/utils/tokenDocsLoader.ts

// @ts-ignore
const OWNER: string = import.meta.env.STORYBOOK_GITHUB_OWNER || 'tjovy';
// @ts-ignore
const REPO: string = import.meta.env.STORYBOOK_GITHUB_REPO || 'ds-documentation-thiga';

// --- INTERFACES TYPESCRIPT ---

export interface BranchItem {
  name: string;
  label?: string;
  sourceRef?: string;
}

export interface DiffItem {
  path: string;
  original: string | null;
  modified: string;
  originalMeta?: Record<string, any> | null;
  modifiedMeta?: Record<string, any> | null;
}

export interface BranchDiffResult {
  diffs: DiffItem[];
  fullBranchDocs: Record<string, any>;
  branchTokens: Record<string, any>;
  branchVariablesCss: string;
  sourceRef: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  commitSha?: string | null;
}

export interface PullRequestResult {
  success: boolean;
  existing?: boolean;
  number?: number;
  url?: string;
  error?: string;
}

// --- HELPERS ---

const callTokenDocsApi = async (payload: Record<string, any>): Promise<any> => {
  const response = await fetch('/api/token-docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API locale indisponible (${response.status})`);
  return data;
};

// --- FONCTIONS ---

export const loadTokenDocs = async (branch: string = 'main'): Promise<Record<string, any>> => {
  try {
    const payload = await callTokenDocsApi({ action: 'loadDocs', branch, owner: OWNER, repo: REPO });
    return payload.docs || {};
  } catch (e) {
    console.error(`[tokenDocsLoader] loadTokenDocs("${branch}") error:`, e);
    return {};
  }
};

export const listAIBranches = async (): Promise<BranchItem[]> => {
  try {
    const payload = await callTokenDocsApi({ action: 'listBranches', owner: OWNER, repo: REPO });
    return Array.isArray(payload.branches) ? payload.branches : [];

  } catch (e) {
    console.error('[tokenDocsLoader] listAIBranches failed:', e);
    return [];
  }
};

export const loadReviewArtifacts = async (branch: string, sourceRef?: string) => {
  const payload = await callTokenDocsApi({ action: 'loadReviewArtifacts', branch, sourceRef, owner: OWNER, repo: REPO });
  return {
    docs: payload.docs || {},
    tokens: payload.tokens || {},
    variablesCss: String(payload.variablesCss || ''),
    sourceRef: String(payload.sourceRef || branch),
  };
};

export const loadBranchDiff = async (branch: string, sourceRef?: string): Promise<BranchDiffResult> => {
  const [mainDocs, review] = await Promise.all([loadTokenDocs('main'), loadReviewArtifacts(branch, sourceRef)]);
  const branchDocs = review.docs;

  const flattenDocs = (obj: any, path: string = ''): Record<string, string> => {
    const res: Record<string, string> = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return res;
    
    if (obj.description && typeof obj.description === 'string') {
      res[path] = obj.description;
    }
    
    for (const key in obj) {
      if (key !== 'description' && key !== '_meta') {
        const newPath = path ? `${path}.${key}` : key;
        Object.assign(res, flattenDocs(obj[key], newPath));
      }
    }
    return res;
  };

  const flatMain = flattenDocs(mainDocs);
  const flatBranch = flattenDocs(branchDocs);
  const getEntryAtPath = (obj: any, path: string): Record<string, any> | null => {
    const entry = path.split('.').reduce((current, key) => current?.[key], obj);
    return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null;
  };
  
  const diffs: DiffItem[] = [];
  for (const key in flatBranch) {
    if (flatBranch[key] !== flatMain[key]) {
      diffs.push({
        path: key,
        original: flatMain[key] || null,
        modified: flatBranch[key],
        originalMeta: getEntryAtPath(mainDocs, key)?._meta || null,
        modifiedMeta: getEntryAtPath(branchDocs, key)?._meta || null,
      });
    }
  }
  return {
    diffs,
    fullBranchDocs: branchDocs,
    branchTokens: review.tokens,
    branchVariablesCss: review.variablesCss,
    sourceRef: review.sourceRef,
  };
};

export const saveTokenDocs = async (
  newDocs: Record<string, any>, 
  branch: string, 
  message: string
): Promise<SaveResult> => {
  try {
    const res = await fetch('/api/token-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', newDocs, branch, message }),
    });
    const payload = await res.json().catch(() => ({}));
    return { success: res.ok, error: payload.error, commitSha: payload.commitSha || null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
};

export const createTokenDocsPullRequest = async (
  branch: string,
  title: string,
  body: string
): Promise<PullRequestResult> => {
  try {
    const res = await fetch('/api/token-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createPullRequest', branch, title, body }),
    });
    const payload = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      existing: payload.existing,
      number: payload.number,
      url: payload.url,
      error: payload.error,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
};
