
import { DEFAULT_OPENROUTER_MODEL, FALLBACK_OPENROUTER_MODEL } from '../constants';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = FALLBACK_OPENROUTER_MODEL;
const processEnv = (typeof globalThis !== 'undefined' ? (globalThis as any)?.process?.env : undefined) || {};

const getOpenRouterKey = () =>
  (import.meta as any)?.env?.VITE_OPENROUTER_API_KEY ||
  processEnv.OPENROUTER_API_KEY ||
  processEnv.API_KEY ||
  '';

const getDefaultModel = () =>
  DEFAULT_OPENROUTER_MODEL ||
  processEnv.OPENROUTER_MODEL ||
  DEFAULT_MODEL;

const FAST_CHAT_MODELS = [
  'nvidia/nemotron-nano-9b-v2:free',
  'stepfun/step-3.5-flash:free',
  'openrouter/sonoma-sky-alpha:free',
  'qwen/qwen3-coder:free',
  'deepseek/deepseek-r1-0528:free'
];

const stripMarkdownFences = (text: string) =>
  text.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```$/, '').trim();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error');
};

const extractOpenRouterText = (data: any): string => {
  const choice = data?.choices?.[0];
  const message = choice?.message || {};

  let content: any = message?.content;
  if (Array.isArray(content)) {
    content = content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n')
      .trim();
  }

  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text.trim();
  }

  return '';
};

const looksLikeCodeRequest = (input: string) => {
  const text = (input || '').toLowerCase();
  if (!text) return false;
  return /(\bhtml\b|\bcss\b|\bjavascript\b|\btypescript\b|\breact\b|\bjsx\b|\btsx\b|\bcode\b|\bcalculator\b|\bscript\b|\bfunction\b|\bcomponent\b|\bsql\b|\bregex\b|\brefactor\b|\bdebug\b|\bfix\b|\bimplement\b|\bgenerate\b)/.test(text);
};

const CHAT_SYSTEM_BASE = [
  'You are Natural Assistant in a coding workspace.',
  'Return final answers only.',
  'Do not reveal chain-of-thought, internal reasoning, or analysis steps.',
  'Be direct and concise.'
].join('\n');

const CHAT_SYSTEM_CODE = [
  CHAT_SYSTEM_BASE,
  'When the user asks for code:',
  '- Put the complete runnable code in fenced code blocks first.',
  '- Use fenced code blocks with the correct language (for example ```html).',
  '- For multi-file answers, output one code block per file and include filename in the fence header, for example: ```html index.html, ```css styles.css, ```javascript app.js.',
  '- Ensure generated code matches the exact requested behavior and is immediately runnable.',
  '- Include complete logic, edge-case handling, and valid syntax (no placeholders/TODOs).',
  '- Keep any explanation to at most 2 short lines after code blocks.',
  '- Never output private chain-of-thought or pseudo-planning.',
  '- Never include internal analysis like "let me think", "first", "next", or planning bullets.',
  '- If unsure, choose a practical implementation and still provide working code.'
].join('\n');

const countCodeFenceTokens = (text: string) => (text.match(/```/g) || []).length;

const balanceCodeFences = (text: string) => {
  if (!text) return text;
  return countCodeFenceTokens(text) % 2 === 1 ? `${text}\n\`\`\`` : text;
};

const hasStructuredCodeBlock = (text: string) => /```[\s\S]+```/.test(balanceCodeFences(text || ''));

const looksLikeRawCode = (text: string) => {
  const value = (text || '').trim();
  if (!value) return false;
  return /<!doctype html|<html|<head|<body|<script|<style|function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|document\./i.test(value);
};

const looksLikePlanningText = (text: string) =>
  /\b(i('|’)ll|let me|first|next|then|outline|step|think|plan)\b/i.test((text || '').toLowerCase());

const stripLeadingNarrationBeforeCode = (text: string) => {
  const value = (text || '').trim();
  if (!value.includes('```')) return value;
  const firstFence = value.indexOf('```');
  if (firstFence <= 0) return value;
  const prefix = value.slice(0, firstFence).trim();
  if (!prefix) return value;
  if (looksLikePlanningText(prefix) || prefix.length > 180) {
    return value.slice(firstFence).trim();
  }
  return value;
};

const inferCodeLanguageFromPrompt = (prompt: string) => {
  const lower = (prompt || '').toLowerCase();
  if (lower.includes('html')) return 'html';
  if (lower.includes('react') || lower.includes('jsx') || lower.includes('tsx')) return 'jsx';
  if (lower.includes('typescript') || lower.includes('ts ')) return 'ts';
  return 'javascript';
};

const FALLBACK_CALCULATOR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Calculator</title>
  <style>
    * { box-sizing: border-box; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at top, #151b2a 0%, #0b0f16 55%, #070a10 100%);
      color: #fff;
    }
    .calculator {
      width: min(92vw, 360px);
      background: #121827;
      border: 1px solid #283248;
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 24px 48px rgba(0,0,0,.45);
    }
    .display {
      width: 100%;
      height: 72px;
      border: 1px solid #2f3c59;
      border-radius: 12px;
      background: #0d1320;
      color: #e7ecff;
      font-size: 30px;
      text-align: right;
      padding: 0 12px;
      margin-bottom: 10px;
      outline: none;
    }
    .keys {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    button {
      height: 56px;
      border: 1px solid #2a3652;
      border-radius: 10px;
      background: #111a2b;
      color: #dbe6ff;
      font-size: 20px;
      cursor: pointer;
      transition: transform .06s ease, background .12s ease, border-color .12s ease;
    }
    button:hover { background: #16233a; border-color: #3c4f75; }
    button:active { transform: translateY(1px) scale(.99); }
    .op { background: #1a2540; color: #a8c7ff; }
    .eq { background: #2563eb; border-color: #3b82f6; color: #fff; }
    .ac { background: #3f1e2a; border-color: #5b2c3d; color: #ffb4c8; }
    .wide { grid-column: span 2; }
  </style>
</head>
<body>
  <div class="calculator">
    <input id="display" class="display" type="text" value="0" readonly />
    <div class="keys">
      <button class="ac wide" data-action="clear">AC</button>
      <button data-action="delete">⌫</button>
      <button class="op" data-value="/">÷</button>
      <button data-value="7">7</button>
      <button data-value="8">8</button>
      <button data-value="9">9</button>
      <button class="op" data-value="*">×</button>
      <button data-value="4">4</button>
      <button data-value="5">5</button>
      <button data-value="6">6</button>
      <button class="op" data-value="-">−</button>
      <button data-value="1">1</button>
      <button data-value="2">2</button>
      <button data-value="3">3</button>
      <button class="op" data-value="+">+</button>
      <button class="wide" data-value="0">0</button>
      <button data-value=".">.</button>
      <button class="eq" data-action="equals">=</button>
    </div>
  </div>
  <script>
    const display = document.getElementById('display');
    let expression = '0';
    const render = () => display.value = expression || '0';
    const isOperator = (c) => ['+', '-', '*', '/'].includes(c);

    document.querySelector('.keys').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const value = btn.dataset.value;

      if (action === 'clear') {
        expression = '0';
        render();
        return;
      }
      if (action === 'delete') {
        expression = expression.length > 1 ? expression.slice(0, -1) : '0';
        render();
        return;
      }
      if (action === 'equals') {
        try {
          const result = Function('return (' + expression + ')')();
          expression = String(result);
        } catch {
          expression = 'Error';
          render();
          setTimeout(() => { expression = '0'; render(); }, 900);
          return;
        }
        render();
        return;
      }
      if (!value) return;

      if (expression === 'Error') expression = '0';

      if (isOperator(value)) {
        const last = expression[expression.length - 1];
        if (isOperator(last)) expression = expression.slice(0, -1) + value;
        else expression += value;
        render();
        return;
      }

      if (value === '.') {
        const tail = expression.split(/[-+*/]/).pop() || '';
        if (tail.includes('.')) return;
      }

      expression = expression === '0' ? value : expression + value;
      render();
    });

    window.addEventListener('keydown', (e) => {
      if (/^[0-9.]$/.test(e.key)) document.querySelector('button[data-value="' + e.key + '"]')?.click();
      if (/^[+\\-*/]$/.test(e.key)) document.querySelector('button[data-value="' + e.key + '"]')?.click();
      if (e.key === 'Enter') document.querySelector('button[data-action="equals"]')?.click();
      if (e.key === 'Backspace') document.querySelector('button[data-action="delete"]')?.click();
      if (e.key === 'Escape') document.querySelector('button[data-action="clear"]')?.click();
    });
  </script>
</body>
</html>`;

const fallbackCodeForPrompt = (prompt: string): string => {
  const lower = (prompt || '').toLowerCase();
  if (lower.includes('calculator') || lower.includes('calc')) {
    return `\`\`\`html\n${FALLBACK_CALCULATOR_HTML}\n\`\`\``;
  }
  const lang = inferCodeLanguageFromPrompt(prompt);
  if (lang === 'html') {
    return `\`\`\`html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>App</title>\n</head>\n<body>\n  <h1>Hello</h1>\n  <p>Starter template generated as fallback.</p>\n</body>\n</html>\n\`\`\``;
  }
  return '';
};

const ensureCodeForwardResponse = async (params: {
  response: string;
  model: string;
  prompt: string;
  history: { role: 'user' | 'model'; text: string }[];
}): Promise<string> => {
  const cleaned = balanceCodeFences((params.response || '').trim());
  const normalized = stripLeadingNarrationBeforeCode(cleaned);
  if (hasStructuredCodeBlock(normalized)) return normalized;
  if (looksLikeRawCode(normalized)) {
    const lang = inferCodeLanguageFromPrompt(params.prompt);
    return `\`\`\`${lang}\n${normalized}\n\`\`\``;
  }

  if (!looksLikePlanningText(normalized) && normalized.length > 120) return normalized;

  try {
    const lang = inferCodeLanguageFromPrompt(params.prompt);
    const repaired = await callOpenRouter({
      model: 'qwen/qwen3-coder:free',
      history: params.history,
      systemInstruction: [
        CHAT_SYSTEM_BASE,
        'Return only one complete runnable code block.',
        `Use language fence: \`\`\`${lang}`,
        'Do not include planning text or bullet points.',
        'No explanations before the code block.'
      ].join('\n'),
      userPrompt: `The previous response was not runnable code. Rewrite as final runnable code only.\n\nOriginal user request:\n${params.prompt}`,
      temperature: 0.08,
      maxTokens: 3200
    });
    const repairedClean = balanceCodeFences((repaired || '').trim());
    if (hasStructuredCodeBlock(repairedClean) || looksLikeRawCode(repairedClean)) {
      return repairedClean;
    }
  } catch {
    // Fallback below.
  }

  const fallback = fallbackCodeForPrompt(params.prompt);
  if (fallback) return fallback;
  return cleaned || '```text\nUnable to generate runnable code.\n```';
};

const callOpenRouter = async (params: {
  systemInstruction?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  history?: { role: 'user' | 'model'; text: string }[];
}): Promise<string> => {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    throw new Error('Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY (Netlify env var).');
  }

  const model = params.model || getDefaultModel();
  const historyMessages =
    params.history?.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.text
    })) || [];

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (params.systemInstruction) {
    messages.push({ role: 'system', content: params.systemInstruction });
  }
  messages.push(...historyMessages);
  messages.push({ role: 'user', content: params.userPrompt });

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Natural Code Editor'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = extractOpenRouterText(data);
  if (!content) {
    throw new Error(`OpenRouter returned empty content. Raw response: ${JSON.stringify(data)?.slice(0, 500)}`);
  }

  return content;
};

// --- Templates ---

const APP_TEMPLATE = (jsxContent: string, containerClasses: string = "min-h-screen p-4 flex flex-col items-center justify-center bg-root", textClasses: string = "text-white") => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              surface: "#1c1e21",
              panel: "#151719",
              border: "#2b3035",
              root: "#0e1011",
              accent: "#3b82f6",
              subtext: "#8d96a0"
            }
          }
        }
      }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect, useRef, useMemo } = React;
        
        function App() {
           const [state, setState] = useState({});

           return (
             <div className="${containerClasses} ${textClasses} transition-all duration-300">
                ${jsxContent}
             </div>
           );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>
`;

const COMPILER_SYSTEM_INSTRUCTION = `
You are an advanced "English-to-App" compiler. Your goal is to translate the user's plain English "code" (pseudocode instructions) into a fully functional, self-contained, single-file HTML web application.

Strict Output Rules:
1. Return ONLY the raw HTML string. Do NOT wrap it in markdown code blocks (e.g., no \`\`\`html).
2. The HTML must be completely self-contained.
3. You MUST use React and ReactDOM via CDN.
4. You MUST use Babel Standalone via CDN to handle JSX.
5. You MUST use Tailwind CSS via CDN for styling.
6. The script tag containing the React logic must have type="text/babel".
7. The App component must be mounted to a div with id="root".
8. Ensure you handle state (useState) and effects (useEffect) correctly based on the description.
9. If the user mentions "local storage" or "save", implement persistence using localStorage.
10. If the user mentions specific icons, use Material Symbols Outlined.

Template structure to follow:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { background-color: #0e1011; color: #e6edf3; font-family: 'Inter', sans-serif; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect, useRef, useMemo } = React;
        
        function App() {
           // ... logic here based on prompt
           return (
             <div className="min-h-screen p-4 flex flex-col items-center justify-center">
                {/* JSX */}
             </div>
           );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>
`;

// --- Local Compiler Logic ---

// Expanded Color Map
const COLOR_MAP: Record<string, string> = {
  // Basic
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  gray: "bg-gray-500",
  white: "bg-white",
  black: "bg-black",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  
  // App Specific
  dark: "bg-[#0e1011]",
  root: "bg-[#0e1011]",
  surface: "bg-[#1c1e21]",
  light: "bg-gray-100",
  slate: "bg-slate-800",
  zinc: "bg-zinc-900",
  neutral: "bg-neutral-900",
};

// Text color helper
const isLightColor = (colorClass: string) => {
    return ['bg-white', 'bg-yellow-400', 'bg-gray-100', 'bg-cyan-500', 'bg-orange-500'].includes(colorClass);
};

const compileLocally = (englishCode: string): string => {
    const lines = englishCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    
    // Compiler State
    let containerClasses = "min-h-screen p-4 flex flex-col items-center justify-center";
    let defaultTextClass = "text-white";
    let elements: string[] = [];
    
    // Track nesting
    let inCard = false;
    let inRow = false;

    // Helpers
    const findColor = (str: string): string | null => {
        const colors = Object.keys(COLOR_MAP);
        // Look for exact matches or matches ending with a space/punctuation
        // Iterate by length to match "dark blue" (if we supported it) before "blue"
        for (const color of colors) {
            if (new RegExp(`\\b${color}\\b`, 'i').test(str)) {
                return color;
            }
        }
        return null;
    };

    const getQuote = (str: string) => {
        const match = str.match(/["']([^"']+)["']/);
        return match ? match[1] : null;
    };

    // Process lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // --- 1. CONFIGURATION ---

        // Background Color
        if (lower.includes('background') || (lower.includes('make it') && findColor(lower))) {
            const color = findColor(lower);
            if (color) {
                const newBg = COLOR_MAP[color] || `bg-${color}-500`;
                // Remove any existing bg class
                containerClasses = containerClasses.replace(/bg-[\w\d-[#\]]+/g, '').trim();
                containerClasses += ` ${newBg}`;
                
                // Adjust text color contrast
                if (isLightColor(newBg)) {
                    defaultTextClass = "text-gray-900";
                } else {
                    defaultTextClass = "text-white";
                }
                continue;
            }
        }

        // Layout alignment
        if (lower.includes('align left') || lower.includes('start')) {
            containerClasses = containerClasses.replace('items-center', 'items-start');
        } else if (lower.includes('align right') || lower.includes('end')) {
            containerClasses = containerClasses.replace('items-center', 'items-end');
        }

        // --- 2. CONTAINER STRUCTURES ---
        
        // Close containers if explicitly asked or implied
        if (lower === 'end card' || lower === 'close card') {
            if (inCard) { elements.push('</div>'); inCard = false; }
            continue;
        }

        // Card / Box
        if (lower.includes('create a card') || lower.includes('centered card') || lower.includes('add a box')) {
            if (inCard) { elements.push('</div>'); } // Close previous
            
            const cardBg = defaultTextClass.includes('white') ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-xl';
            elements.push(`<div className="w-full max-w-md ${cardBg} border p-6 rounded-2xl shadow-lg space-y-4 backdrop-blur-sm relative overflow-hidden">`);
            inCard = true;

            const title = getQuote(line);
            if (title) {
                elements.push(`<h2 className="text-2xl font-bold tracking-tight">${title}</h2>`);
            }
            continue;
        }

        // Row / Columns
        if (lower.includes('create a row') || lower.includes('horizontal stack')) {
             if (inRow) { elements.push('</div>'); }
             elements.push(`<div className="flex flex-row gap-4 w-full items-center justify-center">`);
             inRow = true;
             continue;
        }
        if (lower.includes('end row')) {
             if (inRow) { elements.push('</div>'); inRow = false; }
             continue;
        }

        // --- 3. COMPONENTS ---

        // List
        if (lower.includes('list of') || lower.includes('create a list')) {
            const listBg = inCard ? '' : 'bg-white/5 p-4 rounded-xl';
            elements.push(`<ul className="space-y-3 w-full text-left ${listBg}">`);
            
            // Look ahead for items
            let j = i + 1;
            while(j < lines.length && lines[j].trim().startsWith('-')) {
                const itemText = lines[j].trim().replace(/^-\s*/, '').replace(/['"]/g, '');
                elements.push(`
                    <li className="flex items-center gap-3 group cursor-pointer">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform"></div>
                        <span className="opacity-90 group-hover:opacity-100">${itemText}</span>
                    </li>
                `);
                j++;
            }
            elements.push(`</ul>`);
            i = j - 1; 
            continue;
        }

        // Button
        if (lower.includes('button')) {
            const text = getQuote(line) || "Button";
            const color = findColor(lower);
            const btnBg = color ? (COLOR_MAP[color] || `bg-${color}-500`) : "bg-accent";
            const widthClass = lower.includes('full width') || lower.includes('large') ? 'w-full' : 'min-w-[120px]';
            const shadowClass = lower.includes('shadow') ? 'shadow-lg shadow-blue-500/20' : '';
            
            elements.push(`
                <button 
                    className="${btnBg} ${widthClass} ${shadowClass} text-white px-6 py-2.5 rounded-lg font-medium hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 select-none"
                    onClick={() => alert('${text} clicked!')}
                >
                    ${text}
                </button>
            `);
            continue;
        }

        // Input
        if (lower.includes('input')) {
            const placeholder = getQuote(line) || "Enter text...";
            const type = lower.includes('password') ? 'password' : 'text';
            elements.push(`
                <div className="w-full space-y-1">
                    <label className="text-xs font-semibold uppercase opacity-60 ml-1">${placeholder}</label>
                    <input 
                        type="${type}" 
                        placeholder="${placeholder}" 
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 focus:border-accent focus:bg-accent/5 focus:ring-1 focus:ring-accent outline-none transition-all placeholder:opacity-40" 
                    />
                </div>
            `);
            continue;
        }

        // Heading / Title
        if (lower.includes('title') || lower.startsWith('heading') || lower.startsWith('h1')) {
            const text = getQuote(line) || "Title";
            elements.push(`<h1 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">${text}</h1>`);
            continue;
        }
        
        // Subtitle / H2
        if (lower.includes('subtitle') || lower.startsWith('h2')) {
            const text = getQuote(line) || "Subtitle";
            elements.push(`<h2 className="text-xl font-medium opacity-80 mb-2">${text}</h2>`);
            continue;
        }

        // Paragraph
        if (lower.includes('text') || lower.includes('description') || lower.includes('paragraph') || lower.startsWith('say')) {
            const text = getQuote(line);
            if (text) {
                elements.push(`<p className="opacity-70 leading-relaxed max-w-prose mx-auto">${text}</p>`);
            }
            continue;
        }

        // Navbar
        if (lower.includes('navbar') || lower.includes('navigation')) {
            const title = getQuote(line) || "App";
            // Prepend to elements or insert at top? For local compiler, we just push.
            elements.unshift(`
                <nav className="fixed top-0 left-0 w-full h-16 border-b border-white/10 bg-root/80 backdrop-blur-md flex items-center justify-between px-6 z-50">
                    <div className="font-bold text-lg tracking-wider">${title}</div>
                    <div className="flex gap-4 text-sm font-medium opacity-70">
                        <a href="#" className="hover:text-accent transition-colors">Home</a>
                        <a href="#" className="hover:text-accent transition-colors">About</a>
                        <a href="#" className="hover:text-accent transition-colors">Contact</a>
                    </div>
                </nav>
                <div className="h-16 w-full"></div> 
            `); // Spacer
            continue;
        }

        // Footer
        if (lower.includes('footer')) {
             elements.push(`
                <footer className="w-full py-6 mt-12 border-t border-white/10 text-center opacity-40 text-sm">
                    &copy; ${new Date().getFullYear()} Generated App. All rights reserved.
                </footer>
             `);
             continue;
        }
    }

    if (inRow) elements.push('</div>');
    if (inCard) elements.push('</div>');

    // Default background fallback
    if (!containerClasses.includes('bg-')) {
        containerClasses += " bg-[#0e1011]";
    }

    return APP_TEMPLATE(elements.join('\n'), containerClasses, defaultTextClass);
};

// --- Hybrid Logic ---

const compileHybrid = async (englishCode: string, model?: string): Promise<string> => {
    // 1. Generate naive local code
    const localHtml = compileLocally(englishCode);

    // 2. Ask AI to fix/improve it
    try {
        const response = await callOpenRouter({
            model: model || getDefaultModel(),
            userPrompt: `
            User Requirement:
            ${englishCode}

            Current Implementation (Generated by basic parser):
            ${localHtml}

            Task:
            The Current Implementation is basic and might miss logic (like state or event handlers) or specific styling details requested by the user.
            Refine the code to be fully functional and robust. 
            - Keep the structure if it's good, but improve the logic.
            - Ensure all buttons have meaningful functionality if implied by the prompt.
            - Return the FULL HTML string.
            `,
            systemInstruction: COMPILER_SYSTEM_INSTRUCTION,
            temperature: 0.2
        });

        let text = response || localHtml;
        text = text.replace(/^```html\s*/i, '').replace(/```$/, '');
        return text;
    } catch (e) {
        console.error("Hybrid fix failed, falling back to local", e);
        return localHtml;
    }
};

// --- Main Export ---

export type CompilerMode = 'ai' | 'local' | 'hybrid';

export const compileEnglishToApp = async (englishCode: string, mode: CompilerMode = 'ai', model?: string): Promise<string> => {
  if (mode === 'local') {
      // Simulate slight delay for realism
      await new Promise(r => setTimeout(r, 150));
      return compileLocally(englishCode);
  }

  if (mode === 'hybrid') {
      return compileHybrid(englishCode, model);
  }

  // AI Mode (Default)
  try {
    const response = await callOpenRouter({
      model: model || getDefaultModel(),
      userPrompt: `Compile the following English logic into a React app. Be strict and literal:\n\n${englishCode}`,
      systemInstruction: COMPILER_SYSTEM_INSTRUCTION,
      temperature: 0.1
    });
    
    let text = response || '';
    // Cleanup if the model accidentally includes markdown despite instructions
    text = text.replace(/^```html\s*/i, '').replace(/```$/, '');
    return text;
  } catch (error) {
    console.error("Compilation error:", error);
    throw error;
  }
};

export const explainCode = async (code: string, model?: string): Promise<string> => {
  try {
    const response = await callOpenRouter({
      model: model || getDefaultModel(),
      userPrompt: `Translate the following code into basic, plain English instructions.
      
      Target Audience: A non-technical user who wants to understand what the app does and how it looks.
      
      Rules:
      1. Be concise and imperative (e.g. "Create a...", "Add a...").
      2. Capture the UI structure (cards, buttons, inputs) and key logic.
      3. Avoid technical jargon like "state", "useEffect", "div", "className".
      4. If the code is complex, summarize the high-level goal.
      5. Output plain text only. Do not use markdown blocks.

      Code:
      ${code.substring(0, 10000)}`, // Limit context
      temperature: 0.2
    });
    let text = response?.trim() || "// Could not translate code.";
    text = text.replace(/^```\s*/i, '').replace(/```$/, '');
    return text;
  } catch (e) {
    console.error("Translation error", e);
    throw e;
  }
};

export const modifyEnglishCode = async (currentCode: string, elementContext: { tagName: string, text: string }, modificationPrompt: string, model?: string): Promise<string> => {
    try {
      const response = await callOpenRouter({
        model: model || getDefaultModel(),
        userPrompt: `
  Current App Logic (Plain English):
  "${currentCode}"
  
  User Interaction:
  The user selected an element in the preview (Tag: <${elementContext.tagName}>, Text Content: "${elementContext.text || 'N/A'}") and requested: "${modificationPrompt}".
  
  Task:
  Rewrite the "Current App Logic" to incorporate this change naturally. 
  - Keep the existing logic intact unless it contradicts the new request.
  - Return ONLY the updated plain English logic.
  - Do not explain your changes.
        `,
        systemInstruction: 'You are an expert code modification assistant. Return only the updated English pseudocode.',
        temperature: 0.3
      });
      return response?.trim() || currentCode;
    } catch (error) {
      console.error("Modification error:", error);
      throw error;
    }
  };

export const generateEnglishLogic = async (userPrompt: string, currentCode: string, model?: string): Promise<string> => {
    try {
      const response = await callOpenRouter({
        model: model || getDefaultModel(),
        userPrompt: `
  Example User Input: "Make a login form"
  Example Output:
  Create a centered card with a shadow.
  Inside, add a title "Login".
  Add an input for "Username".
  Add a password input for "Password".
  Add a button "Sign In".
  When "Sign In" is clicked:
  - If username is empty, show an error "Username required".
  - Otherwise, navigate to "Dashboard".
  
  User Input: "${userPrompt}"
  Current Code Context:
  "${currentCode}"
  
  Generate the English Code for the User Input. Return ONLY the code lines.
        `,
        systemInstruction: `
  You are an expert Ghostwriter for a Natural Code Editor. 
  The user provides a high-level intent (e.g., "Build a calculator").
  You must break this down into specific, implementation-ready "English Code" instructions.
  
  "English Code" Style Guide:
  - Use imperative verbs: "Create", "Add", "Show", "When".
  - Describe the UI structure: "Create a centered card", "Add a row with 3 buttons".
  - Describe interactions: "When 'Calculate' is clicked: multiply input A by input B".
  - Be concise but complete.
  - Do NOT output Javascript or HTML. Output plain English instructions.
            `,
        temperature: 0.5
      });
  
      return response?.trim() || "";
    } catch (error) {
      console.error("Logic generation error:", error);
      throw error;
    }
  };

export const getAutocompleteSuggestion = async (textContext: string): Promise<string> => {
    // Avoid API calls for very short context or empty strings
    if (!textContext || textContext.length < 5) return "";
  
    try {
      const response = await callOpenRouter({
        model: getDefaultModel(),
        userPrompt: `Context (end of file): "${textContext.slice(-200)}"`,
        systemInstruction: `
  You are a code completion AI for an English-based programming tool.
  The user is writing instructions. Complete their current sentence or add the next logical brief instruction.
  
  Rules:
  1. Return ONLY the completion text.
  2. Do not repeat the input text.
  3. Keep it very short (max 6-8 words).
  4. If the sentence is complete, suggest the next logical action (e.g. "When clicked...").
  5. Do NOT use quotes in the output.
            `,
        maxTokens: 20,
        temperature: 0.2
      });
  
      return response ? response.trimEnd() : "";
    } catch (error) {
      // Fail silently for autocomplete
      return "";
    }
  };

export const sendChatMessage = async (previousHistory: {role: 'user' | 'model', text: string}[], newMessage: string, model: string = DEFAULT_MODEL): Promise<string> => {
    const preferredModel = model || getDefaultModel();
    const isCodeRequest = looksLikeCodeRequest(newMessage);
    const systemInstruction = isCodeRequest ? CHAT_SYSTEM_CODE : CHAT_SYSTEM_BASE;
    const candidateModels = Array.from(new Set([
      preferredModel,
      getDefaultModel(),
      ...FAST_CHAT_MODELS
    ].filter(Boolean)));
    const errors: string[] = [];

    for (const candidate of candidateModels) {
      try {
        const response = await callOpenRouter({
          model: candidate,
          systemInstruction,
          history: previousHistory,
          userPrompt: newMessage,
          temperature: isCodeRequest ? 0.18 : 0.35,
          maxTokens: isCodeRequest ? 2200 : 900
        });
        if (!isCodeRequest) return response || "No response text.";
        const normalized = await ensureCodeForwardResponse({
          response,
          model: candidate,
          prompt: newMessage,
          history: previousHistory
        });
        return normalized || "No response text.";
      } catch (error) {
        const msg = getErrorMessage(error);
        console.error(`Chat error on model "${candidate}"`, error);
        errors.push(`${candidate}: ${msg}`);
      }
    }

    const summary = errors[errors.length - 1] || 'Unknown model error.';
    return `Model request failed.\n\n${summary}`;
};

export const generateChatTitle = async (message: string): Promise<string> => {
    const sanitizeTitle = (raw: string) => {
        const title = stripMarkdownFences(raw).split('\n')[0].trim();
        const words = title.split(/\s+/).filter(Boolean);
        if (!title) return '';
        if (/^new chat\b/i.test(title)) return '';
        if (words.length > 5) return words.slice(0, 5).join(' ');
        if (words.length >= 2) return title;
        return '';
    };

    try {
        const response = await callOpenRouter({
            model: 'openrouter/sonoma-sky-alpha:free',
            userPrompt: `Generate a clear chat title for this first message: "${message}".
Rules:
- 3 to 5 words only
- summarize the main topic
- plain text only
- no quotes
- no punctuation at the end`,
            temperature: 0.2,
            maxTokens: 24
        });
        const first = sanitizeTitle(response);
        if (first) return first;

        const retry = await callOpenRouter({
            model: 'openrouter/sonoma-sky-alpha:free',
            userPrompt: `Create a concise 2-5 word title for this conversation context:\n${message}\nReturn title text only.`,
            temperature: 0.1,
            maxTokens: 20
        });
        return sanitizeTitle(retry);
    } catch (e) {
        return "";
    }
};
