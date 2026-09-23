export function normalizeOutputPath(tokenPath) {
  return String(tokenPath || '')
    .replace(/^component\.button\.size\./, 'component.button.')
    .replace(/^component\.button\.variants\./, 'component.button.');
}

export function cssVarNameFromPath(tokenPath) {
  const normalizedPath = normalizeOutputPath(tokenPath);

  return `--${normalizedPath
    .replace(/\$/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}
