import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const distDir = path.join(rootDir, 'dist');

await fs.mkdir(distDir, { recursive: true });
await build({
  entryPoints: [path.join(rootDir, 'src', 'code.ts')],
  outfile: path.join(distDir, 'code.js'),
  bundle: true,
  target: 'es2022',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
});
await fs.copyFile(path.join(rootDir, 'src', 'ui.html'), path.join(distDir, 'ui.html'));

console.log('Plugin Figma compilé dans figma-token-exporter/dist.');
