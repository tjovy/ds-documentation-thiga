import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_PATH = '/Users/atypic/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.THIGA_N8N_WORKFLOW_ID || 'TlWx5OmmkqEk5yoA';
const WORKFLOW_NAME = 'ds-documentation-thiga';
const GITHUB_OWNER = 'tjovy';
const GITHUB_REPOSITORY = 'ds-documentation-thiga';
const GITHUB_CREDENTIAL = { id: '0VPNkKqc7Pju3PKI', name: 'git-demo-thiga' };
const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const BACKUP_PATH = here('./backups/ds-documentation-thiga.before-patch.json');
const EXPORT_PATH = here('./workflows/ds-documentation-thiga.json');

function sqlite(args) {
  return execFileSync('sqlite3', [DB_PATH, ...args], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

function textLiteral(value) {
  return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
}

function requireNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node introuvable: ${name}`);
  return node;
}

function requireAnyNode(nodes, names) {
  const node = nodes.find((item) => names.includes(item.name));
  if (!node) throw new Error(`Node introuvable: ${names.join(' ou ')}`);
  return node;
}

function apiHeaders(node) {
  node.parameters.sendHeaders = true;
  node.parameters.headerParameters = {
    parameters: [
      { name: 'Accept', value: 'application/vnd.github+json' },
      { name: 'X-GitHub-Api-Version', value: '2022-11-28' },
    ],
  };
}

function repositorySelector(value, url) {
  return { __rl: true, value, mode: 'list', cachedResultName: value, cachedResultUrl: url };
}

const row = JSON.parse(sqlite([
  '-json', '-batch',
  `select id, name, nodes, connections, settings from workflow_entity where id = '${WORKFLOW_ID}';`,
]))[0];
if (!row) throw new Error(`Workflow introuvable: ${WORKFLOW_ID}`);

const nodes = JSON.parse(row.nodes);
const connections = JSON.parse(row.connections);
mkdirSync(dirname(BACKUP_PATH), { recursive: true });
writeFileSync(BACKUP_PATH, JSON.stringify({
  id: row.id, name: row.name, nodes, connections, settings: JSON.parse(row.settings || '{}'),
}, null, 2));

const prompt = readFileSync(here('./prompts/component-doc-generator.md'), 'utf8').trim();
const generatorTemplate = readFileSync(here('./code/openai-generate-markdown.template.js'), 'utf8');
const generatorCode = generatorTemplate.replace('__SYSTEM_PROMPT__', JSON.stringify(prompt));
if (generatorCode.includes('__SYSTEM_PROMPT__')) throw new Error('Injection du prompt OpenAI incomplete');

requireNode(nodes, 'Filtrer les composants incomplets').parameters.jsCode = readFileSync(here('./code/filter-incomplete-components.js'), 'utf8');
requireNode(nodes, 'Get component generation context').parameters.jsCode = readFileSync(here('./code/get-component-generation-context.js'), 'utf8');
requireNode(nodes, 'Finalize + Validate').parameters.jsCode = readFileSync(here('./code/finalize-component-docs.js'), 'utf8');
const generatorNode = requireAnyNode(nodes, ['OpenAI Low Cost — Generate Markdown', 'OpenAI GPT-5.6 Sol — Generate Markdown']);
generatorNode.name = 'OpenAI Low Cost — Generate Markdown';
generatorNode.parameters.jsCode = generatorCode;

const sourceRef = requireAnyNode(nodes, ['Get source main ref', 'Get main ref']);
sourceRef.name = 'Get source main ref';
sourceRef.position = [-320, 48];
sourceRef.parameters.url = 'https://api.github.com/repos/tjovy/ds-documentation-thiga/git/ref/heads/main';
apiHeaders(sourceRef);

const trigger = requireNode(nodes, "When clicking 'Execute workflow'");
trigger.position = [-544, 48];
const docsNode = requireNode(nodes, 'Get tokens-docs.json');
const tokensNode = requireNode(nodes, 'Get tokens.json');
for (const node of [docsNode, tokensNode]) {
  node.parameters.owner = repositorySelector(GITHUB_OWNER, `https://github.com/${GITHUB_OWNER}`);
  node.parameters.repository = repositorySelector(
    GITHUB_REPOSITORY,
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}`,
  );
}
docsNode.parameters.additionalParameters = { reference: '={{ $("Get source main ref").first().json.object.sha }}' };
tokensNode.parameters.additionalParameters = { reference: '={{ $("Get source main ref").first().json.object.sha }}' };

for (const node of nodes) {
  if (node.credentials?.githubApi) node.credentials.githubApi = { ...GITHUB_CREDENTIAL };
}

for (const name of ['Create docs branch', 'Get docs file metadata', 'Push tokens-docs.json']) {
  apiHeaders(requireNode(nodes, name));
}
const createBranch = requireNode(nodes, 'Create docs branch');
createBranch.parameters.jsonBody = '={{ { ref: "refs/heads/" + $("Finalize + Validate").first().json.branchName, sha: $("Finalize + Validate").first().json.baseSha } }}';

connections["When clicking 'Execute workflow'"] = { main: [[{ node: 'Get source main ref', type: 'main', index: 0 }]] };
connections['Get source main ref'] = { main: [[{ node: 'Get tokens-docs.json', type: 'main', index: 0 }]] };
connections['Process One at a Time'] = {
  main: [
    [{ node: 'Finalize + Validate', type: 'main', index: 0 }],
    [{ node: 'OpenAI Low Cost — Generate Markdown', type: 'main', index: 0 }],
  ],
};
connections['OpenAI Low Cost — Generate Markdown'] = { main: [[{ node: 'Process One at a Time', type: 'main', index: 0 }]] };
connections['Finalize + Validate'] = { main: [[{ node: 'Create docs branch', type: 'main', index: 0 }]] };
delete connections['OpenAI GPT-5.6 Sol — Generate Markdown'];
delete connections['Get main ref'];

const sql = `
update workflow_entity set
  name = ${textLiteral(WORKFLOW_NAME)},
  nodes = ${textLiteral(JSON.stringify(nodes))},
  connections = ${textLiteral(JSON.stringify(connections))},
  updatedAt = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
where id = '${WORKFLOW_ID}';
update workflow_history set
  nodes = ${textLiteral(JSON.stringify(nodes))},
  connections = ${textLiteral(JSON.stringify(connections))},
  updatedAt = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')
where versionId = (select versionId from workflow_entity where id = '${WORKFLOW_ID}');
`;
sqlite([sql]);

const previousExport = JSON.parse(readFileSync(EXPORT_PATH, 'utf8'));
const exported = Array.isArray(previousExport) ? previousExport[0] : previousExport;
exported.nodes = nodes;
exported.connections = connections;
exported.id = WORKFLOW_ID;
exported.name = WORKFLOW_NAME;
exported.updatedAt = new Date().toISOString();
writeFileSync(EXPORT_PATH, JSON.stringify([exported], null, 2));

console.log(`Workflow ${WORKFLOW_ID} mis a jour: contexte compact, validation/repair bornee, SHA GitHub fige.`);
console.log(`Export synchronise: ${EXPORT_PATH}`);
console.log(`Backup: ${BACKUP_PATH}`);
