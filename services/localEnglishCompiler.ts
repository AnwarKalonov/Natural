export type LocalCodeLanguage =
  | 'html'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'sql'
  | 'json'
  | 'markdown'
  | 'plaintext';

export interface AutoConvertOptions {
  batchSize?: number;
  convertPartial?: boolean;
}

export interface AutoConvertResult {
  content: string;
  convertedLines: number;
  batchCount: number;
  convertedBlocks: Array<{ startLine: number; endLine: number; lines: number }>;
}

const ENGLISH_CODE_THRESHOLD = 0.72;

const ACTION_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  { pattern: /\btitle\b|\bheading\b|\bheader\b/i, action: 'title' },
  { pattern: /\bbutton\b/i, action: 'button' },
  { pattern: /\binput\b|\bfield\b|\btextbox\b/i, action: 'input' },
  { pattern: /\bparagraph\b|\btext\b|\bcopy\b/i, action: 'paragraph' },
  { pattern: /\bimage\b|\bphoto\b|\bicon\b/i, action: 'image' },
  { pattern: /\bcontainer\b|\bsection\b|\bcard\b|\bpanel\b/i, action: 'container' },
  { pattern: /\blist\b|\bitems\b|\bbullets?\b/i, action: 'list' },
  { pattern: /\bfunction\b|\bmethod\b/i, action: 'function' },
  { pattern: /\blog\b|\bprint\b|\bconsole\b/i, action: 'log' },
  { pattern: /\bselect\b|\bquery\b|\btable\b|\bsql\b/i, action: 'query' }
];

const CODE_LINE_PATTERNS: RegExp[] = [
  /[{}()[\];]/,
  /^\s*(const|let|var|function|class|if|for|while|return|import|export|async|await)\b/i,
  /^\s*<\/?[a-z][^>]*>/i,
  /^\s*[.#]?[a-z0-9_-]+\s*\{\s*$/i,
  /^\s*(def|from|print|lambda|try|except|with)\b/i,
  /^\s*(select|insert|update|delete|create|alter|drop)\b/i,
  /^\s*\/\//,
  /^\s*--/,
  /^\s*#/,
  /=>/,
  /:\s*\w+\s*[=,)]/
];

const sanitizeText = (text: string) => text.replace(/[<>]/g, '').trim();

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const quoteIfNeeded = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '""';
  if (/^(true|false|null)$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  return JSON.stringify(trimmed);
};

const extractQuoted = (line: string): string | null => {
  const match = line.match(/"([^"]+)"|'([^']+)'/);
  if (!match) return null;
  return match[1] || match[2] || null;
};

const toIdentifier = (line: string, fallback: string) => {
  const cleaned = line
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || fallback;
};

const toKebab = (line: string, fallback: string) => {
  const cleaned = line
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || fallback;
};

const detectAction = (line: string) => {
  for (const item of ACTION_PATTERNS) {
    if (item.pattern.test(line)) return item.action;
  }
  return 'paragraph';
};

const extractAttrValue = (line: string, key: string): string | null => {
  const withQuoted = line.match(new RegExp(`${key}\\s*(?:=|as|to)?\\s*["']([^"']+)["']`, 'i'));
  if (withQuoted?.[1]) return withQuoted[1].trim();
  const bare = line.match(new RegExp(`${key}\\s*(?:=|as|to)?\\s*([a-z0-9_-]+)`, 'i'));
  if (bare?.[1]) return bare[1].trim();
  return null;
};

const splitList = (input: string) =>
  input
    .split(/,|\band\b/gi)
    .map(item => sanitizeText(item))
    .filter(Boolean);

const inferHtmlTag = (line: string) => {
  const explicit = line.match(/\b(?:add|create)\s+(?:an?\s+)?(div|section|article|main|header|footer|nav|button|input|textarea|form|ul|ol|li|p|h1|h2|h3|span|a|img)\b/i);
  if (explicit?.[1]) return explicit[1].toLowerCase();

  const action = detectAction(line);
  if (action === 'title') return 'h1';
  if (action === 'button') return 'button';
  if (action === 'input') return 'input';
  if (action === 'image') return 'img';
  if (action === 'list') return 'ul';
  if (action === 'container') return 'section';
  return 'p';
};

const compileHtmlLine = (line: string, idx: number) => {
  const clean = sanitizeText(line);
  const quoted = sanitizeText(extractQuoted(line) || clean);
  const tag = inferHtmlTag(line);

  const id = extractAttrValue(line, 'id');
  const className = extractAttrValue(line, 'class');
  const placeholder = extractAttrValue(line, 'placeholder');
  const href = extractAttrValue(line, 'href') || extractAttrValue(line, 'link');

  const attrs: string[] = [];
  if (id) attrs.push(`id=\"${id}\"`);
  if (className) attrs.push(`class=\"${className}\"`);

  if (tag === 'img') {
    const src = extractAttrValue(line, 'src') || 'https://placehold.co/960x540';
    attrs.push(`src=\"${src}\"`, `alt=\"${quoted || `Image ${idx + 1}`}\"`);
    return `<img ${attrs.join(' ')} />`;
  }

  if (tag === 'input') {
    const type = extractAttrValue(line, 'type') || 'text';
    attrs.push(`type=\"${type}\"`);
    attrs.push(`placeholder=\"${placeholder || quoted || 'Type here'}\"`);
    return `<input ${attrs.join(' ')} />`;
  }

  if (tag === 'a') {
    attrs.push(`href=\"${href || '#'}\"`);
    return `<a ${attrs.join(' ')}>${quoted || 'Open link'}</a>`;
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = splitList(quoted.replace(/^.*(?:items?|list)\s*/i, ''));
    if (items.length === 0) {
      return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}><li>${quoted || 'List item'}</li></${tag}>`;
    }
    return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>${items
      .map(item => `<li>${item}</li>`)
      .join('')}</${tag}>`;
  }

  if (tag === 'button') {
    const buttonType = extractAttrValue(line, 'type') || 'button';
    attrs.push(`type=\"${buttonType}\"`);
    return `<button ${attrs.join(' ')}>${quoted || 'Click me'}</button>`;
  }

  const attrSegment = attrs.length ? ` ${attrs.join(' ')}` : '';
  const body = quoted || `Section ${idx + 1}`;
  return `<${tag}${attrSegment}>${body}</${tag}>`;
};

const parseCssSelector = (line: string) => {
  const rawSelector =
    extractAttrValue(line, 'selector') ||
    extractAttrValue(line, 'target') ||
    extractAttrValue(line, 'for') ||
    (line.toLowerCase().includes('body') ? 'body' : '');

  if (!rawSelector) return '.component';
  if (/^[.#]/.test(rawSelector)) return rawSelector;
  if (/^(body|html|main|header|footer|section|button|input|a|p|h1|h2|h3|img)$/i.test(rawSelector)) {
    return rawSelector.toLowerCase();
  }
  return `.${toKebab(rawSelector, 'component')}`;
};

const compileCssLine = (line: string, idx: number) => {
  const lower = line.toLowerCase();
  const selector = parseCssSelector(line);

  const propertyMap: Array<{ test: RegExp; prop: string }> = [
    { test: /background/, prop: 'background' },
    { test: /text color|font color|color/, prop: 'color' },
    { test: /font size/, prop: 'font-size' },
    { test: /font weight|bold/, prop: 'font-weight' },
    { test: /padding|spacing inside/, prop: 'padding' },
    { test: /margin|spacing outside/, prop: 'margin' },
    { test: /radius|rounded/, prop: 'border-radius' },
    { test: /width/, prop: 'width' },
    { test: /height/, prop: 'height' },
    { test: /shadow/, prop: 'box-shadow' },
    { test: /border/, prop: 'border' },
    { test: /align center|center/, prop: 'text-align' }
  ];

  for (const item of propertyMap) {
    if (item.test.test(lower)) {
      let value = extractAttrValue(line, 'to') || extractAttrValue(line, 'value') || '';

      if (!value) {
        const match = line.match(/\b(?:to|as)\s+([^,]+)$/i);
        value = sanitizeText(match?.[1] || '');
      }

      if (!value) {
        if (item.prop === 'text-align') value = 'center';
        else if (item.prop === 'box-shadow') value = '0 10px 30px rgba(0, 0, 0, 0.25)';
        else if (item.prop === 'font-size') value = '16px';
        else if (item.prop === 'padding' || item.prop === 'margin') value = '16px';
        else if (item.prop === 'border-radius') value = '12px';
        else value = 'initial';
      }

      if (item.prop === 'font-weight' && /bold/.test(lower) && value === 'initial') value = '700';
      return `${selector} { ${item.prop}: ${value}; }`;
    }
  }

  if (/flex/.test(lower)) {
    return `${selector} { display: flex; gap: 12px; align-items: center; }`;
  }

  return `.rule-${idx + 1} { /* ${sanitizeText(line)} */ }`;
};

const compileJsLikeLine = (line: string, idx: number, typed: boolean) => {
  const lower = line.toLowerCase();
  const quoted = sanitizeText(extractQuoted(line) || line);

  const variableMatch = line.match(/\b(?:set|create|declare)\s+(?:a\s+)?(?:variable\s+)?([a-z_][a-z0-9_]*)\s+(?:to|as|=)\s+(.+)$/i);
  if (variableMatch) {
    const variableName = toIdentifier(variableMatch[1], `value_${idx + 1}`);
    const variableValue = sanitizeText(variableMatch[2]);
    const value = quoteIfNeeded(variableValue);
    if (typed) {
      const type = /^-?\d+(\.\d+)?$/.test(variableValue)
        ? 'number'
        : /^(true|false)$/i.test(variableValue)
          ? 'boolean'
          : 'string';
      return `const ${variableName}: ${type} = ${value};`;
    }
    return `const ${variableName} = ${value};`;
  }

  const functionMatch = line.match(/\b(?:create|make|add)\s+function\s+([a-z_][a-z0-9_\s-]*)/i);
  if (functionMatch) {
    const functionName = toIdentifier(functionMatch[1], `task_${idx + 1}`);
    return typed
      ? `function ${functionName}(): void {\n  console.log(${JSON.stringify(quoted)});\n}`
      : `function ${functionName}() {\n  console.log(${JSON.stringify(quoted)});\n}`;
  }

  const clickMatch = line.match(/\bwhen\s+([^\s]+)\s+(?:is\s+)?clicked\s+(.*)$/i);
  if (clickMatch) {
    const selector = clickMatch[1].trim();
    const effect = sanitizeText(clickMatch[2] || 'log click');
    return [
      `document.querySelector(${JSON.stringify(selector)})?.addEventListener('click', () => {`,
      `  console.log(${JSON.stringify(effect)});`,
      `});`
    ].join('\n');
  }

  const fetchMatch = line.match(/\bfetch\s+(?:from\s+)?(https?:\/\/\S+)/i);
  if (fetchMatch) {
    const url = fetchMatch[1].trim();
    return [
      `fetch(${JSON.stringify(url)})`,
      `  .then((response) => response.json())`,
      `  .then((data) => console.log(data))`,
      `  .catch((error) => console.error(error));`
    ].join('\n');
  }

  if (/\blog\b|\bprint\b|\bconsole\b/.test(lower)) {
    return `console.log(${JSON.stringify(quoted)});`;
  }

  return typed
    ? `const step${idx + 1}: string = ${JSON.stringify(quoted)};`
    : `const step${idx + 1} = ${JSON.stringify(quoted)};`;
};

const compilePythonLine = (line: string, idx: number) => {
  const lower = line.toLowerCase();
  const quoted = sanitizeText(extractQuoted(line) || line);

  const variableMatch = line.match(/\b(?:set|create|declare)\s+(?:a\s+)?(?:variable\s+)?([a-z_][a-z0-9_]*)\s+(?:to|as|=)\s+(.+)$/i);
  if (variableMatch) {
    const name = toIdentifier(variableMatch[1], `value_${idx + 1}`);
    const value = quoteIfNeeded(sanitizeText(variableMatch[2]));
    return `${name} = ${value}`;
  }

  const functionMatch = line.match(/\b(?:create|make|add)\s+function\s+([a-z_][a-z0-9_\s-]*)/i);
  if (functionMatch) {
    const functionName = toIdentifier(functionMatch[1], `task_${idx + 1}`);
    return [`def ${functionName}():`, `    print(${JSON.stringify(quoted)})`].join('\n');
  }

  if (/\blog\b|\bprint\b/.test(lower)) {
    return `print(${JSON.stringify(quoted)})`;
  }

  return `${toIdentifier(quoted, `step_${idx + 1}`)} = ${JSON.stringify(quoted)}`;
};

const compileSqlLine = (line: string, idx: number) => {
  const lower = normalizeSpaces(line.toLowerCase());

  const createTable = lower.match(/(?:create|new) table ([a-z_][a-z0-9_]*)/i);
  if (createTable) {
    const table = createTable[1];
    const colsRaw = line.match(/(?:columns?|fields?)\s+(.+)$/i)?.[1] || 'name text';
    const cols = splitList(colsRaw).map((col, columnIndex) => {
      const parts = col.trim().split(/\s+/);
      if (parts.length === 1) {
        return `${toIdentifier(parts[0], `column_${columnIndex + 1}`)} text`;
      }
      return `${toIdentifier(parts[0], `column_${columnIndex + 1}`)} ${parts.slice(1).join(' ').toLowerCase()}`;
    });
    return `create table if not exists ${table} (id bigint generated always as identity primary key, ${cols.join(', ')});`;
  }

  const insertMatch = line.match(/\binsert\s+into\s+([a-z_][a-z0-9_]*)\s*(?:values?)?\s*(.*)$/i);
  if (insertMatch) {
    const table = insertMatch[1];
    const values = splitList(insertMatch[2] || 'sample');
    if (values.length === 0) {
      return `insert into ${table} default values;`;
    }
    return `insert into ${table} (value) values ${values.map(value => `(${quoteIfNeeded(value)})`).join(', ')};`;
  }

  const selectMatch = line.match(/\b(?:select|query|show)\s+(?:from\s+)?([a-z_][a-z0-9_]*)/i);
  if (selectMatch) {
    return `select * from ${selectMatch[1]} order by id desc limit 100;`;
  }

  if (/\bdelete\b/.test(lower)) {
    const table = line.match(/\bfrom\s+([a-z_][a-z0-9_]*)/i)?.[1] || `table_${idx + 1}`;
    return `delete from ${table} where id > 0;`;
  }

  if (/\bupdate\b/.test(lower)) {
    const table = line.match(/\bupdate\s+([a-z_][a-z0-9_]*)/i)?.[1] || `table_${idx + 1}`;
    return `update ${table} set updated_at = now() where id > 0;`;
  }

  return `-- ${sanitizeText(line)}`;
};

const compileJsonLine = (line: string, idx: number) => {
  const setMatch = line.match(/\b(?:set|add|create)\s+([a-zA-Z0-9_\-.]+)\s+(?:to|as|=)\s+(.+)$/i);
  if (setMatch) {
    const key = setMatch[1].replace(/[^a-zA-Z0-9_\-.]/g, '_');
    const rawValue = sanitizeText(setMatch[2]);
    return `  ${JSON.stringify(key)}: ${quoteIfNeeded(rawValue)}`;
  }
  return `  ${JSON.stringify(`item_${idx + 1}`)}: ${JSON.stringify(sanitizeText(line))}`;
};

const compileMarkdownLine = (line: string, idx: number) => {
  const action = detectAction(line);
  const quoted = sanitizeText(extractQuoted(line) || line);

  if (action === 'title') return `## ${quoted}`;
  if (action === 'list') return `- ${quoted}`;
  if (/\bcode\b/i.test(line)) return `\`${quoted}\``;
  return `${idx + 1}. ${quoted}`;
};

export const detectLanguageFromFilename = (filename: string): LocalCodeLanguage => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'py') return 'python';
  if (ext === 'sql') return 'sql';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  return 'plaintext';
};

export const isLikelyCodeLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CODE_LINE_PATTERNS.some(pattern => pattern.test(trimmed));
};

export const isLikelyEnglishLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isLikelyCodeLine(trimmed)) return false;

  const letters = (trimmed.match(/[a-z]/gi) || []).length;
  const symbols = (trimmed.match(/[{}()[\];=<>&|:+\-*/$]/g) || []).length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  if (words < 2) return false;
  if (letters === 0) return false;

  const score = letters / Math.max(letters + symbols, 1);
  const hasKeywords = ACTION_PATTERNS.some(item => item.pattern.test(trimmed));
  return score >= ENGLISH_CODE_THRESHOLD || hasKeywords;
};

export const compileEnglishLinesToCode = (lines: string[], language: LocalCodeLanguage): string => {
  const filtered = lines.map(line => line.trim()).filter(Boolean);
  if (filtered.length === 0) return '';

  if (language === 'json') {
    const rows = filtered.map((line, idx) => compileJsonLine(line, idx)).join(',\n');
    return `{\n${rows}\n}`;
  }

  if (language === 'html') return filtered.map((line, idx) => compileHtmlLine(line, idx)).join('\n');
  if (language === 'css') return filtered.map((line, idx) => compileCssLine(line, idx)).join('\n');
  if (language === 'javascript') return filtered.map((line, idx) => compileJsLikeLine(line, idx, false)).join('\n\n');
  if (language === 'typescript') return filtered.map((line, idx) => compileJsLikeLine(line, idx, true)).join('\n\n');
  if (language === 'python') return filtered.map((line, idx) => compilePythonLine(line, idx)).join('\n\n');
  if (language === 'sql') return filtered.map((line, idx) => compileSqlLine(line, idx)).join('\n');
  if (language === 'markdown') return filtered.map((line, idx) => compileMarkdownLine(line, idx)).join('\n');

  return filtered.map((line, idx) => `step_${idx + 1}: ${sanitizeText(line)}`).join('\n');
};

export const autoConvertEnglishBatches = (
  content: string,
  filename: string,
  options: AutoConvertOptions = {}
): AutoConvertResult => {
  const batchSize = Math.max(1, options.batchSize || 5);
  const convertPartial = !!options.convertPartial;

  if (!content.trim()) {
    return {
      content,
      convertedLines: 0,
      batchCount: 0,
      convertedBlocks: []
    };
  }

  const lines = content.split('\n');
  const language = detectLanguageFromFilename(filename);
  const out: string[] = [];
  const convertedBlocks: Array<{ startLine: number; endLine: number; lines: number }> = [];

  let i = 0;
  let convertedLines = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!isLikelyEnglishLine(line)) {
      out.push(line);
      i += 1;
      continue;
    }

    const blockStart = i;
    const englishBlock: string[] = [];

    while (i < lines.length && isLikelyEnglishLine(lines[i])) {
      englishBlock.push(lines[i].trim());
      i += 1;
    }

    let convertibleCount = Math.floor(englishBlock.length / batchSize) * batchSize;
    if (convertPartial && englishBlock.length > 0 && convertibleCount !== englishBlock.length) {
      convertibleCount = englishBlock.length;
    }

    if (convertibleCount === 0) {
      out.push(...englishBlock);
      continue;
    }

    const convertibleLines = englishBlock.slice(0, convertibleCount);
    const remainingLines = englishBlock.slice(convertibleCount);

    if (convertibleLines.length % batchSize === 0) {
      for (let offset = 0; offset < convertibleLines.length; offset += batchSize) {
        const batch = convertibleLines.slice(offset, offset + batchSize);
        const code = compileEnglishLinesToCode(batch, language);
        out.push(...code.split('\n'));
      }
    } else {
      const code = compileEnglishLinesToCode(convertibleLines, language);
      out.push(...code.split('\n'));
    }

    out.push(...remainingLines);

    convertedLines += convertibleCount;
    convertedBlocks.push({
      startLine: blockStart + 1,
      endLine: blockStart + convertibleCount,
      lines: convertibleCount
    });
  }

  const batchCount = Math.floor(convertedLines / batchSize) + (convertPartial && convertedLines % batchSize !== 0 ? 1 : 0);

  return {
    content: out.join('\n'),
    convertedLines,
    batchCount,
    convertedBlocks
  };
};

export const createTemplateForFileName = (filename: string): string => {
  const language = detectLanguageFromFilename(filename);

  if (language === 'html') {
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '  <title>New Page</title>',
      '</head>',
      '<body>',
      '  <main>',
      '    <h1>Hello</h1>',
      '  </main>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  if (language === 'css') {
    return [
      ':root {',
      '  color-scheme: dark;',
      '}',
      '',
      'body {',
      '  margin: 0;',
      '  font-family: Inter, system-ui, sans-serif;',
      '}'
    ].join('\n');
  }

  if (language === 'javascript') {
    return [
      "const app = document.querySelector('#app');",
      '',
      'function start() {',
      "  console.log('ready');",
      '}',
      '',
      'start();'
    ].join('\n');
  }

  if (language === 'typescript') {
    return [
      "const app = document.querySelector('#app') as HTMLElement | null;",
      '',
      'function start(): void {',
      "  console.log('ready');",
      '}',
      '',
      'start();'
    ].join('\n');
  }

  if (language === 'python') {
    return [
      'def main() -> None:',
      "    print('ready')",
      '',
      "if __name__ == '__main__':",
      '    main()'
    ].join('\n');
  }

  if (language === 'sql') {
    return [
      'create table if not exists items (',
      '  id bigint generated always as identity primary key,',
      '  name text not null,',
      '  created_at timestamptz default now()',
      ');',
      '',
      'select * from items order by id desc;'
    ].join('\n');
  }

  if (language === 'json') {
    return ['{', '  "name": "new-project",', '  "version": 1', '}'].join('\n');
  }

  if (language === 'markdown') {
    return ['# New Document', '', '- Start writing here'].join('\n');
  }

  return '';
};
