import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const label = 'fr.atypic.ds-documentation-thiga-storybook';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();
const plistPath = path.join(home, 'Library', 'LaunchAgents', `${label}.plist`);
const uid = process.getuid();
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const command = `source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && exec node scripts/storybook-with-token-sync.js`;
const port = process.env.STORYBOOK_PORT || '6007';
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>${escapeXml(command)}</string></array>
  <key>WorkingDirectory</key><string>${escapeXml(root)}</string>
  <key>EnvironmentVariables</key><dict><key>STORYBOOK_PORT</key><string>${escapeXml(port)}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/ds-thiga-storybook.log</string>
  <key>StandardErrorPath</key><string>/tmp/ds-thiga-storybook.error.log</string>
</dict></plist>
`;

fs.mkdirSync(path.dirname(plistPath), { recursive: true });
fs.writeFileSync(plistPath, plist, 'utf8');
try {
  execFileSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
} catch {}
execFileSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
execFileSync('launchctl', ['enable', `gui/${uid}/${label}`]);
console.log(`Storybook service installed: ${plistPath}`);
