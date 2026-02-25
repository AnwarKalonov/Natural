export const looksLikeCode = (text: string) => {
  const value = (text || '').trim();
  if (!value) return false;
  return /<\/?[a-z][^>]*>|\b(const|let|function|class|return|import|export|if|for|while)\b|[{};]|=>|\bdef\b|\bselect\b|\bcreate table\b/i.test(value);
};

const fromHtml = (code: string) => {
  const out: string[] = [];
  if (/<form/i.test(code)) out.push('Create a form section for user input.');
  if (/<input/i.test(code)) out.push('Add input fields for user data.');
  if (/<button/i.test(code)) out.push('Add clickable button actions.');
  if (/<h1|<h2|<h3/i.test(code)) out.push('Show clear page headings.');
  if (/<nav/i.test(code)) out.push('Include top navigation for page sections.');
  if (/<img/i.test(code)) out.push('Render images in the interface.');
  if (out.length === 0) out.push('Build a structured web page layout with sections and content.');
  return out;
};

const fromCss = (code: string) => {
  const out: string[] = [];
  if (/background/i.test(code)) out.push('Set background colors and visual surface styling.');
  if (/display:\s*flex/i.test(code)) out.push('Arrange related content using horizontal or vertical flex layout.');
  if (/grid/i.test(code)) out.push('Arrange UI areas with a grid layout.');
  if (/padding|margin/i.test(code)) out.push('Apply spacing so the layout has clear visual rhythm.');
  if (/border-radius/i.test(code)) out.push('Use rounded corners for modern component styling.');
  if (/box-shadow/i.test(code)) out.push('Add subtle depth using shadows on cards or panels.');
  if (out.length === 0) out.push('Style the UI for readable spacing, color contrast, and alignment.');
  return out;
};

const fromJs = (code: string) => {
  const out: string[] = [];
  if (/addEventListener\(['"]click/i.test(code)) out.push('Handle click interactions from buttons or controls.');
  if (/fetch\(|axios\./i.test(code)) out.push('Load data from an API and process the response.');
  if (/localStorage/i.test(code)) out.push('Persist user data in local storage.');
  if (/console\.log/i.test(code)) out.push('Log internal state for debugging and verification.');
  if (/querySelector|getElementById/i.test(code)) out.push('Read or update DOM elements by selector.');
  if (/function\s+[a-zA-Z_]|=>/i.test(code)) out.push('Define reusable logic functions for app behavior.');
  if (out.length === 0) out.push('Implement interactive behavior and data flow for the interface.');
  return out;
};

const fromPython = (code: string) => {
  const out: string[] = [];
  if (/def\s+/i.test(code)) out.push('Define reusable Python functions for app logic.');
  if (/print\(/i.test(code)) out.push('Print key runtime information for debugging or output.');
  if (/class\s+/i.test(code)) out.push('Create classes to organize state and behavior.');
  if (/requests\.|httpx\./i.test(code)) out.push('Call external services and handle responses.');
  if (out.length === 0) out.push('Implement backend or utility logic in Python.');
  return out;
};

const fromSql = (code: string) => {
  const out: string[] = [];
  if (/create\s+table/i.test(code)) out.push('Create database tables to store structured records.');
  if (/insert\s+into/i.test(code)) out.push('Insert new records into the database.');
  if (/select\s+/i.test(code)) out.push('Query records from stored data.');
  if (/update\s+/i.test(code)) out.push('Update existing records using controlled conditions.');
  if (/delete\s+/i.test(code)) out.push('Remove records that are no longer needed.');
  if (out.length === 0) out.push('Define and query relational data structures.');
  return out;
};

export const summarizeCodeToEnglish = (code: string, fileName: string) => {
  const name = (fileName || '').toLowerCase();
  let bullets: string[] = [];

  if (name.endsWith('.html') || /<html|<body|<div/i.test(code)) bullets = fromHtml(code);
  else if (name.endsWith('.css')) bullets = fromCss(code);
  else if (name.endsWith('.py')) bullets = fromPython(code);
  else if (name.endsWith('.sql')) bullets = fromSql(code);
  else bullets = fromJs(code);

  const limited = bullets.slice(0, 6);
  return limited.map(item => `- ${item}`).join('\n');
};
