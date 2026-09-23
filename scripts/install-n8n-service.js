import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const label = 'fr.atypic.n8n-thiga';
const home = os.homedir();
const plistPath = path.join(home, 'Library', 'LaunchAgents', `${label}.plist`);
const uid = process.getuid();
const nodeDir = '$HOME/.nvm/versions/node/v22.22.0/bin';
const command = [
  'set -a',
  '[ -f "$HOME/.n8n/.env" ] && source "$HOME/.n8n/.env"',
  'set +a',
  `export PATH="${nodeDir}:$PATH"`,
  'export N8N_BLOCK_ENV_ACCESS_IN_NODE=false',
  'export N8N_RUNNERS_TASK_REQUEST_TIMEOUT="${N8N_RUNNERS_TASK_REQUEST_TIMEOUT:-180}"',
  'exec "$HOME/.nvm/versions/node/v22.22.0/bin/node" "$HOME/.nvm/versions/node/v22.22.0/lib/node_modules/n8n/bin/n8n"',
].join('; ');
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>${command.replaceAll('&', '&amp;')}</string></array>
  <key>WorkingDirectory</key><string>${home}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${home}/.n8n/n8n.log</string>
  <key>StandardErrorPath</key><string>${home}/.n8n/n8n.error.log</string>
</dict></plist>
`;

fs.mkdirSync(path.dirname(plistPath), { recursive: true });
fs.writeFileSync(plistPath, plist, 'utf8');
try {
  execFileSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
} catch {}
execFileSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
execFileSync('launchctl', ['enable', `gui/${uid}/${label}`]);
console.log(`n8n service installed: ${plistPath}`);
