import type { Plugin } from 'vite';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function readBody(request: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function readGithubError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  return payload?.message || `${response.status} ${response.statusText}`;
}

function githubContentsUrl(owner: string, repo: string, ref: string, filePath: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`;
}

async function loadGithubFile(owner: string, repo: string, ref: string, filePath: string): Promise<Buffer> {
  const token = resolveGithubToken(process.env.STORYBOOK_GITHUB_TOKEN);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const fileResponse = await fetch(githubContentsUrl(owner, repo, ref, filePath), { headers });
  if (!fileResponse.ok) throw new Error(`Lecture GitHub impossible pour ${filePath} (${fileResponse.status})`);
  const file = await fileResponse.json();
  const encoded = String(file?.content || '').replace(/\s+/g, '');
  if (!encoded) throw new Error(`Contenu GitHub vide pour ${filePath}`);
  return Buffer.from(encoded, 'base64');
}

async function resolveReviewRef(branch: string): Promise<string> {
  const { stdout } = await execFileAsync('git', [
    'ls-remote',
    '--heads',
    'origin',
    `refs/heads/${branch}`,
  ], { cwd: process.cwd() });
  const sha = String(stdout || '').trim().split(/\s+/)[0] || '';
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error(`Branche de review introuvable: ${branch}`);
  return sha;
}

async function loadReviewArtifacts(owner: string, repo: string, branch: string, sourceRef?: string) {
  // Resolve the branch head once, then pin all reads to that SHA. The client hint
  // is deliberately ignored when stale, so a review cannot mix another commit's files.
  const currentRef = await resolveReviewRef(branch);
  const ref = String(sourceRef || '').toLowerCase() === currentRef.toLowerCase() ? String(sourceRef) : currentRef;
  const [docsFile, tokensFile, cssFile] = await Promise.all([
    loadGithubFile(owner, repo, ref, 'tokens-docs.json'),
    loadGithubFile(owner, repo, ref, 'tokens.json'),
    loadGithubFile(owner, repo, ref, 'build/css/variables.css'),
  ]);

  return {
    docs: JSON.parse(docsFile.toString('utf8')),
    tokens: JSON.parse(tokensFile.toString('utf8')),
    variablesCss: cssFile.toString('utf8'),
    sourceRef: ref,
  };
}

function resolveGithubToken(configuredToken?: string): string {
  if (configuredToken && configuredToken.length > 20) return configuredToken;
  try {
    const credential = execFileSync('git', ['credential', 'fill'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'protocol=https\nhost=github.com\n\n',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return credential
      .split('\n')
      .find((line) => line.startsWith('password='))
      ?.slice('password='.length) || '';
  } catch {
    return '';
  }
}

export function githubTokenDocsPlugin(): Plugin {
  return {
    name: 'thiga-token-docs-api',
    configureServer(server) {
      server.middlewares.use('/api/token-docs', async (request, response) => {
        response.setHeader('Content-Type', 'application/json');
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: 'Methode non autorisee' }));
          return;
        }

        const owner = process.env.STORYBOOK_GITHUB_OWNER || 'tjovy';
        const repo = process.env.STORYBOOK_GITHUB_REPO || 'ds-documentation-thiga';

        try {
          const payload = JSON.parse(await readBody(request));
          const action = payload.action || 'save';
          const branch = String(payload.branch || '');

          if (action === 'listBranches') {
            const { stdout } = await execFileAsync('git', [
              'ls-remote',
              '--heads',
              'origin',
              'refs/heads/ai/*',
            ], { cwd: process.cwd() });
            const branches = String(stdout || '')
              .split('\n')
              .map((line) => line.trim().split(/\s+/))
              .filter(([, ref]) => ref?.startsWith('refs/heads/ai/'))
              .map(([sha, ref]) => ({ name: ref.replace('refs/heads/', ''), sourceRef: sha }))
              .sort((a, b) => b.name.localeCompare(a.name));
            response.statusCode = 200;
            response.end(JSON.stringify({ success: true, branches }));
            return;
          }

          if (action === 'loadDocs') {
            if (!(branch === 'main' || branch.startsWith('ai/'))) throw new Error('Branche de lecture non autorisee');
            response.statusCode = 200;
            response.end(JSON.stringify({ success: true, docs: JSON.parse((await loadGithubFile(owner, repo, branch, 'tokens-docs.json')).toString('utf8')) }));
            return;
          }

          if (action === 'loadReviewArtifacts') {
            if (!branch.startsWith('ai/')) throw new Error('Une branche ai/* est requise pour une review');
            response.statusCode = 200;
            response.end(JSON.stringify({ success: true, ...(await loadReviewArtifacts(owner, repo, branch, payload.sourceRef)) }));
            return;
          }

          const token = resolveGithubToken(process.env.STORYBOOK_GITHUB_TOKEN);
          if (!token) throw new Error('Authentification GitHub indisponible pour Storybook');
          if (!branch.startsWith('ai/')) throw new Error('Seules les branches de revue ai/* sont autorisees en ecriture');
          const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          };

          if (action === 'save') {
            const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/tokens-docs.json`;
            const metadata = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
            if (!metadata.ok) throw new Error(`Lecture GitHub impossible: ${await readGithubError(metadata)}`);
            const file = await metadata.json();
            const content = Buffer.from(JSON.stringify(payload.newDocs, null, 2), 'utf8').toString('base64');
            const update = await fetch(endpoint, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                message: payload.message || 'docs: update component review',
                content,
                branch,
                sha: file.sha,
              }),
            });
            if (!update.ok) throw new Error(`Ecriture GitHub impossible: ${await readGithubError(update)}`);
            const result = await update.json();
            response.statusCode = 200;
            response.end(JSON.stringify({ success: true, commitSha: result?.commit?.sha || null }));
            return;
          }

          if (action === 'createPullRequest') {
            const pullsEndpoint = `https://api.github.com/repos/${owner}/${repo}/pulls`;
            const query = new URLSearchParams({
              state: 'open',
              head: `${owner}:${branch}`,
              base: 'main',
            });
            const existingResponse = await fetch(`${pullsEndpoint}?${query}`, { headers });
            if (!existingResponse.ok) {
              throw new Error(`Recherche de PR impossible: ${await readGithubError(existingResponse)}`);
            }
            const existing = await existingResponse.json();
            if (Array.isArray(existing) && existing[0]) {
              response.statusCode = 200;
              response.end(JSON.stringify({
                success: true,
                existing: true,
                number: existing[0].number,
                url: existing[0].html_url,
              }));
              return;
            }

            const createdResponse = await fetch(pullsEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                title: payload.title || `docs: review ${branch.replace(/^ai\//, '')}`,
                head: branch,
                base: 'main',
                body: payload.body || 'Documentation composant validee depuis Storybook.',
              }),
            });
            if (!createdResponse.ok) {
              throw new Error(`Creation de PR impossible: ${await readGithubError(createdResponse)}`);
            }
            const created = await createdResponse.json();
            response.statusCode = 200;
            response.end(JSON.stringify({
              success: true,
              existing: false,
              number: created.number,
              url: created.html_url,
            }));
            return;
          }

          throw new Error(`Action inconnue: ${action}`);
        } catch (error: any) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: error?.message || 'Erreur inconnue' }));
        }
      });
    },
  };
}
