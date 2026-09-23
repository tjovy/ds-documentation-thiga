import { normalizeCodeSnippetToVariables } from './codeSnippetNormalizer.js';

const DESCRIPTION_HEADING = '## Description développeur';
const SPEC_HEADING = '## Spec';
const DO_DONT_HEADING = "## Do & Don't";
const CODE_HEADING = '## 💻 Code interactif (Live Editor)';

const DESCRIPTION_HEADING_RX = /^##\s+Description(?:\s+développeur)?\b.*$/im;
const SPEC_HEADING_RX = /^##\s+(?:Spec|Specs|Sp[eé]cifications?)\b.*$/im;
const DO_DONT_HEADING_RX = /^##\s+Do\s*&\s*Don['’]t\b.*$/im;
const CODE_HEADING_RX = /^##\s+(?:(?:💻\s*)?Code interactif(?:\s*\(Live Editor\))?|Code React)\b.*$/im;

const normalize = (value = '') => String(value).replace(/\r\n/g, '\n');

const getSectionRange = (markdown, headingRegex) => {
  const match = headingRegex.exec(markdown);
  if (!match || match.index == null) return null;

  const headingStart = match.index;
  const headingEnd = headingStart + match[0].length;
  const afterHeading = markdown.slice(headingEnd);
  const nextHeading = afterHeading.match(/\n##\s+/);
  const sectionEnd = nextHeading ? headingEnd + nextHeading.index : markdown.length;

  return { headingStart, headingEnd, sectionEnd };
};

const getSectionBody = (markdown, headingRegex) => {
  const range = getSectionRange(markdown, headingRegex);
  if (!range) return '';
  return markdown.slice(range.headingEnd, range.sectionEnd).trim();
};

const normalizeListText = (value = '') =>
  normalize(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*]\s+|(?:✅|✔️|❌|✗)\s*)/, '').trim())
    .join('\n');

const toBullets = (value = '', placeholder) => {
  const lines = normalizeListText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const safeLines = lines.length > 0 ? lines : [placeholder];
  return safeLines.map((line) => `- ${line}`).join('\n');
};

const extractCode = (value = '') => {
  const codeBlock = value.match(/```(?:[a-z]+)?\n([\s\S]*?)```/i);
  if (codeBlock) return codeBlock[1].trim();
  return value.trim();
};

const parseDoDontSection = (value = '') => {
  const body = normalize(value);
  const doMatch = body.match(
    /(?:✅|✔️)?\s*\*\*Do\*\*([\s\S]*?)(?=\n\s*(?:❌|✗)?\s*\*\*Don['’]t\*\*|$)/i
  );
  const dontMatch = body.match(/(?:❌|✗)?\s*\*\*Don['’]t\*\*([\s\S]*)/i);

  if (doMatch || dontMatch) {
    return {
      doList: normalizeListText(doMatch ? doMatch[1] : ''),
      dontList: normalizeListText(dontMatch ? dontMatch[1] : '')
    };
  }

  const doLines = [];
  const dontLines = [];
  let currentTarget = null;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const doLine = line.match(/^(?:✅|✔️)?\s*Do\b\s*:?\s*(.*)$/i);
    if (doLine) {
      currentTarget = doLines;
      if (doLine[1]) currentTarget.push(doLine[1].trim());
      continue;
    }

    const dontLine = line.match(/^(?:❌|✗)?\s*Don['’]t\b\s*:?\s*(.*)$/i);
    if (dontLine) {
      currentTarget = dontLines;
      if (dontLine[1]) currentTarget.push(dontLine[1].trim());
      continue;
    }

    if (currentTarget) {
      currentTarget.push(line.replace(/^[-*]\s+/, '').trim());
    }
  }

  return {
    doList: normalizeListText(doLines.join('\n')),
    dontList: normalizeListText(dontLines.join('\n'))
  };
};

const replaceOrAppendSection = (markdown, headingRegex, heading, body) => {
  const range = getSectionRange(markdown, headingRegex);
  const section = `${heading}\n${body}\n`;

  if (!range) {
    return `${markdown.trimEnd()}\n\n${section}`.replace(/^\n+/, '');
  }

  const before = markdown.slice(0, range.headingStart).replace(/\s*$/, '\n\n');
  const after = markdown.slice(range.sectionEnd).replace(/^\s*/, '\n\n');
  return `${before}${section}${after}`.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
};

export const parseEditableDocSections = (markdown = '') => {
  const source = normalize(markdown);
  const description = getSectionBody(source, DESCRIPTION_HEADING_RX);
  const spec = getSectionBody(source, SPEC_HEADING_RX);
  const doDontBody = getSectionBody(source, DO_DONT_HEADING_RX);
  const codeSection = getSectionBody(source, CODE_HEADING_RX);
  const { doList, dontList } = parseDoDontSection(doDontBody);

  return {
    description: description || '',
    spec: spec || '',
    doList,
    dontList,
    code: normalizeCodeSnippetToVariables(extractCode(codeSection))
  };
};

export const mergeEditableDocSections = (markdown = '', sections = {}) => {
  const source = normalize(markdown);
  const descriptionBody = (sections.description || '').trim() || 'À compléter.';
  const specBody = (sections.spec || '').trim() || 'À compléter.';
  const doDontBody =
    `✅ **Do**\n${toBullets(sections.doList, 'Bonne pratique à préciser.')}\n\n` +
    `❌ **Don't**\n${toBullets(sections.dontList, 'Anti-pattern à éviter.')}`;
  const codeBody = `\`\`\`jsx\n${normalizeCodeSnippetToVariables((sections.code || '').trim() || '// code example')}\n\`\`\``;

  let next = source;
  next = replaceOrAppendSection(next, DESCRIPTION_HEADING_RX, DESCRIPTION_HEADING, descriptionBody);
  next = replaceOrAppendSection(next, SPEC_HEADING_RX, SPEC_HEADING, specBody);
  next = replaceOrAppendSection(next, DO_DONT_HEADING_RX, DO_DONT_HEADING, doDontBody);
  next = replaceOrAppendSection(next, CODE_HEADING_RX, CODE_HEADING, codeBody);

  return next.replace(/\n{3,}/g, '\n\n').trimEnd();
};
