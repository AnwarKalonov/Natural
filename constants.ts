import { ExamplePrompt } from './types';

export interface OpenRouterModelOption {
  id: string;
  label: string;
  shortLabel: string;
  bestFor: string;
}

export const FALLBACK_OPENROUTER_MODEL = 'nvidia/nemotron-nano-9b-v2:free';

export const DEFAULT_OPENROUTER_MODEL =
  FALLBACK_OPENROUTER_MODEL;

export const OPENROUTER_FREE_MODELS: OpenRouterModelOption[] = [
  { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1', shortLabel: 'R1', bestFor: 'deep reasoning and planning' },
  { id: 'openrouter/sonoma-sky-alpha:free', label: 'Sonoma Sky Alpha', shortLabel: 'Sky', bestFor: 'general chat and quick drafts' },
  { id: 'stepfun/step-3.5-flash:free', label: 'Step 3.5 Flash', shortLabel: 'Step', bestFor: 'fast responses and brainstorming' },
  { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder', shortLabel: 'Qwen', bestFor: 'code generation and debugging' },
  { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nemotron Nano 9B', shortLabel: 'Nano', bestFor: 'lightweight edits and quick checks' },
];

export const WELCOME_CONTENT = `// Welcome to the Natural Code Editor
// =================================
//
// This is a revolutionary editor where you can write plain English instructions
// and they are compiled into functional React applications using AI.
//
// HOW TO USE:
// 1. Create a new file (e.g., "todo.en" or just "app")
// 2. Describe your app in the file using imperative language.
//    Example:
//    "Create a card with a title 'Hello World'.
//     Add a button that shows an alert when clicked."
//
// 3. Click the "Run" button at the top to compile and preview.
//
// FEATURES:
// - Natural Language Compilation
// - Instant Preview
// - Ghostwriter AI assistance (CMD+K)
//
// You can also create standard files (.html, .js, .css) to use this 
// as a regular code editor.

Create a centered card container with title "Welcome".
Add a description text "Select a file to start editing or create a new one.".
Add a list of features:
- "Natural Language Compilation"
- "Multi-language Support"
- "AI Ghostwriter"
`;

export const EXAMPLE_PROMPTS: ExamplePrompt[] = []; // Cleared as requested

export const DEFAULT_IFRAME_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #0e1011;
      color: #8d96a0;
      text-align: center;
    }
    h2 { font-weight: 500; color: #e6edf3; }
  </style>
</head>
<body>
  <div>
    <h2>Ready to compile</h2>
    <p>Select a file and click Run to start.</p>
  </div>
</body>
</html>
`;
