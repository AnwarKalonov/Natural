import React, { useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  ArrowUp,
  Bot,
  MessageSquare,
  FileCode2,
  Eye,
  Wrench,
  Plus,
  Search,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';
import { sendChatMessage } from '../../services/geminiService';
import { compileEnglishLinesToCode } from '../../services/localEnglishCompiler';
import { summarizeCodeToEnglish } from './utils/codeToEnglish';
import { BottomBar } from './BottomBar';
import { FileTreePanel } from './FileTreePanel';
import { PreviewPanel } from './PreviewPanel';
import { TopBar } from './TopBar';
import { WorkspaceFileNode } from './types';
import { useCollaborationPresence } from './hooks/useCollaborationPresence';
import { useWorkspaceFiles } from './hooks/useWorkspaceFiles';
import { detectLanguage, getNodePath } from './utils/fileTree';

interface NaturalWorkspaceProps {
  projectName: string;
  userName: string;
  onBack: () => void;
}

type EditorMode = 'code' | 'natural';
type NaturalLineMap = {
  englishStart: number;
  englishEnd: number;
  codeStartLine: number;
  codeEndLine: number;
};
type TranslationDetail = 'less' | 'balanced' | 'more';

const mapLanguage = (language?: string) => {
  if (!language) return 'plaintext';
  if (language === 'python') return 'python';
  if (language === 'typescript') return 'typescript';
  if (language === 'javascript') return 'javascript';
  if (language === 'html') return 'html';
  if (language === 'css') return 'css';
  if (language === 'json') return 'json';
  if (language === 'markdown') return 'markdown';
  if (language === 'sql') return 'sql';
  return 'plaintext';
};

const buildPreviewHtml = (nodes: Record<string, WorkspaceFileNode>) => {
  const files = Object.values(nodes).filter(node => node.type === 'file');
  const htmlFile = files.find(file => file.name.endsWith('.html'));
  if (!htmlFile || !htmlFile.content) return '<!doctype html><html><body><p>No HTML file in project.</p></body></html>';

  let html = htmlFile.content;
  const cssFile = files.find(file => file.name.endsWith('.css'));
  const jsFile = files.find(file => file.name.endsWith('.js') || file.name.endsWith('.ts'));

  if (cssFile?.content) {
    html = html.replace(/<link[^>]+href=["'][^"']+\.css["'][^>]*>/i, `<style>\n${cssFile.content}\n</style>`);
  }
  if (jsFile?.content) {
    html = html.replace(/<script[^>]+src=["'][^"']+\.(js|ts)["'][^>]*><\/script>/i, `<script>\n${jsFile.content}\n</script>`);
  }

  return html;
};

const computeErrorCount = (markers: Monaco.editor.IMarker[]) =>
  markers.filter(marker => marker.severity === 8 || marker.severity === 4).length;

const findSnippetLine = (code: string, snippet: string): number | null => {
  if (!snippet) return null;
  const target = snippet.replace(/\s+/g, ' ').trim();
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    if (line && target.includes(line.slice(0, Math.min(line.length, 40)))) return i + 1;
  }
  return null;
};

const cleanModelCode = (value: string) =>
  (value || '')
    .replace(/^```[\w-]*\n?/g, '')
    .replace(/```$/g, '')
    .trim();

type AgentCodeBlock = {
  lang: string;
  fileHint: string;
  code: string;
};

type AgentProposedChange = {
  id: string;
  fileId: string | null;
  fileName: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  isNewFile: boolean;
};

type MiniDiffLine = { kind: 'added' | 'removed' | 'unchanged'; text: string };

const parseAgentCodeBlocks = (text: string): AgentCodeBlock[] => {
  const blocks: AgentCodeBlock[] = [];
  const regex = /```([\w-]+)?(?:\s+([^\n`]+))?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text || '')) !== null) {
    const lang = (match[1] || '').trim().toLowerCase();
    const fileHint = (match[2] || '').trim();
    const code = (match[3] || '').trim();
    if (code) blocks.push({ lang, fileHint, code });
  }
  return blocks;
};

const normalizeInstruction = (line: string) =>
  line
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[\.\)]\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const sanitizeFileName = (value: string, fallback: string) => {
  const trimmed = value.trim().split('/').pop() || '';
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || fallback;
};

const buildMiniDiff = (oldContent: string, newContent: string): MiniDiffLine[] => {
  const a = (oldContent || '').split('\n');
  const b = (newContent || '').split('\n');
  const max = Math.max(a.length, b.length);
  const out: MiniDiffLine[] = [];
  for (let i = 0; i < max; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === right && left !== undefined) {
      out.push({ kind: 'unchanged', text: left });
      continue;
    }
    if (left !== undefined) out.push({ kind: 'removed', text: left });
    if (right !== undefined) out.push({ kind: 'added', text: right });
  }
  return out;
};

const inferFileKind = (fileName: string) => {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.jsx') || lower.endsWith('.tsx')) return 'js';
  if (lower.endsWith('.json')) return 'json';
  return 'text';
};

const parseTagInfo = (line: string) => {
  const tagMatch = line.match(/^<\s*([a-z0-9-]+)/i);
  const tag = tagMatch?.[1]?.toLowerCase();
  const id = line.match(/\sid=["']([^"']+)["']/i)?.[1];
  const className = line.match(/\sclass=["']([^"']+)["']/i)?.[1];
  const src = line.match(/\ssrc=["']([^"']+)["']/i)?.[1];
  const href = line.match(/\shref=["']([^"']+)["']/i)?.[1];
  const content = line.match(/>([^<]+)</)?.[1]?.trim();
  return { tag, id, className, src, href, content };
};

const applyDetail = (base: string, detail: TranslationDetail) => {
  if (!base) return '';
  if (detail === 'less') return base;
  if (detail === 'more') return `${base} Ensure this behavior remains consistent with related UI logic.`;
  return base;
};

const toPseudocodeLine = (line: string, fileName: string, detail: TranslationDetail) => {
  const normalized = line.trim();
  if (!normalized) return '';

  const kind = inferFileKind(fileName);

  if (kind === 'html') {
    if (/^<!doctype/i.test(normalized)) return 'Start an HTML5 document.';
    if (/^<\/?(html|head|body)>$/i.test(normalized)) return '';
    if (/^<meta[^>]*viewport/i.test(normalized)) return 'Add responsive viewport support for mobile devices.';
    if (/^<title>/i.test(normalized)) {
      const value = normalized.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || 'page';
      return `Set the page title to "${value}".`;
    }
    if (/^<link[^>]*stylesheet/i.test(normalized)) {
      const href = normalized.match(/href=["']([^"']+)["']/i)?.[1] || 'stylesheet';
      return `Load external stylesheet "${href}".`;
    }
    if (/^<script[^>]*src=/i.test(normalized)) {
      const src = normalized.match(/src=["']([^"']+)["']/i)?.[1] || 'script';
      return `Load JavaScript file "${src}" for app logic.`;
    }
    if (/^<\/[a-z0-9-]+>$/i.test(normalized)) return '';
    if (/^<input/i.test(normalized)) {
      const id = normalized.match(/id=["']([^"']+)["']/i)?.[1];
      const placeholder = normalized.match(/placeholder=["']([^"']+)["']/i)?.[1];
      return applyDetail(`Add an input${id ? ` (${id})` : ''}${placeholder ? ` with placeholder "${placeholder}"` : ''}.`, detail);
    }
    if (/^<button/i.test(normalized)) {
      const label = normalized.match(/>([^<]*)</)?.[1]?.trim() || 'button';
      return applyDetail(`Add a button labeled "${label}".`, detail);
    }
    const info = parseTagInfo(normalized);
    if (info.tag === 'h1' || info.tag === 'h2' || info.tag === 'h3') {
      return applyDetail(`Show heading text "${info.content || 'Heading'}".`, detail);
    }
    if (info.tag === 'p') {
      return applyDetail(`Show paragraph text "${info.content || 'Text'}".`, detail);
    }
    if (info.tag === 'div' || info.tag === 'section' || info.tag === 'main') {
      if (info.id) return applyDetail(`Create a ${info.tag} container with id "${info.id}".`, detail);
      if (info.className) return applyDetail(`Create a ${info.tag} container with class "${info.className}".`, detail);
      return applyDetail(`Create a ${info.tag} container for layout.`, detail);
    }
    if (info.tag === 'img') {
      return applyDetail(`Render an image${info.src ? ` from "${info.src}"` : ''}.`, detail);
    }
    return applyDetail('Add the next HTML structure line for the page.', detail);
  }

  if (kind === 'css') {
    if (/^[.#a-z0-9\-\s:,>+*[\]()"'=]+\{$/i.test(normalized)) return 'Start style rules for the selected UI element.';
    if (normalized === '}') return '';
    const cssDecl = normalized.match(/^([a-z-]+)\s*:\s*([^;]+);?$/i);
    if (cssDecl) {
      const prop = cssDecl[1].toLowerCase();
      const val = cssDecl[2].trim();
      return applyDetail(`Set ${prop} to ${val}.`, detail);
    }
    return applyDetail('Add a CSS styling rule for layout or appearance.', detail);
  }

  if (kind === 'js') {
    if (/^function\s+([a-z0-9_]+)/i.test(normalized)) {
      const name = normalized.match(/^function\s+([a-z0-9_]+)/i)?.[1];
      return applyDetail(`Define function "${name}" to handle behavior.`, detail);
    }
    if (/^(const|let|var)\s+/i.test(normalized)) {
      const name = normalized.match(/^(?:const|let|var)\s+([a-z0-9_]+)/i)?.[1] || 'variable';
      return applyDetail(`Create variable "${name}" for state or configuration.`, detail);
    }
    if (/addEventListener\s*\(/i.test(normalized)) return applyDetail('Attach an event listener for user interaction.', detail);
    if (/document\.(getElementById|querySelector|querySelectorAll)/i.test(normalized)) return applyDetail('Select a DOM element to read or update it.', detail);
    if (/return\b/i.test(normalized)) return 'Return a computed value from this logic block.';
    if (/^(if|else if|else)\b/i.test(normalized)) return applyDetail('Apply conditional logic for different cases.', detail);
    if (/^(for|while)\b/i.test(normalized)) return applyDetail('Repeat this logic for a sequence of items.', detail);
    if (/^\}/.test(normalized)) return '';
    return applyDetail('Add a JavaScript logic step.', detail);
  }

  if (kind === 'json') return applyDetail('Set a configuration field in this JSON object.', detail);
  return applyDetail(normalized, detail);
};

export const NaturalWorkspace: React.FC<NaturalWorkspaceProps> = ({ projectName, userName, onBack }) => {
  const {
    nodes,
    rootId,
    activeFileId,
    setActiveFileId,
    activeFile,
    dirtyFileIds,
    createNode,
    renameNode,
    removeNode,
    moveFileNode,
    toggleFolder,
    updateFileContent,
    saveFile
  } = useWorkspaceFiles();

  const [editorMode, setEditorMode] = useState<EditorMode>('code');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(8);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [errorCount, setErrorCount] = useState(0);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; snippet: string; line: number | null } | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiChatLoading, setIsAiChatLoading] = useState(false);
  const [agentProposedChanges, setAgentProposedChanges] = useState<AgentProposedChange[]>([]);
  const [naturalDocs, setNaturalDocs] = useState<Record<string, string>>({});
  const [naturalMappings, setNaturalMappings] = useState<Record<string, NaturalLineMap[]>>({});
  const [linkedCodeRange, setLinkedCodeRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isNaturalTranslating, setIsNaturalTranslating] = useState(false);
  const [naturalTranslateMessage, setNaturalTranslateMessage] = useState('');
  const [isBackTranslating, setIsBackTranslating] = useState(false);
  const [translationDetail, setTranslationDetail] = useState<TranslationDetail>('balanced');
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'tools' | 'preview'>('tools');
  const [leftPanelTab, setLeftPanelTab] = useState<'agent' | 'files'>('agent');

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const naturalEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const naturalCodePreviewRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const linkedMainDecorationsRef = useRef<string[]>([]);
  const linkedNaturalPreviewDecorationsRef = useRef<string[]>([]);
  const naturalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const naturalTranslateRevisionRef = useRef(0);
  const naturalLineToCodeCacheRef = useRef<Record<string, string>>({});
  const codeLineToNaturalCacheRef = useRef<Record<string, string>>({});
  const naturalLineStateRef = useRef<Record<string, { englishLines: string[]; lineCodes: string[] }>>({});
  const naturalSourceCodeRef = useRef<Record<string, string>>({});
  const naturalBackfillDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiFeedRef = useRef<HTMLDivElement | null>(null);

  const { collaborators, updateCursor } = useCollaborationPresence(userName, activeFileId || null);

  const previewHtml = useMemo(() => buildPreviewHtml(nodes), [nodes]);

  useEffect(() => {
    if (!activeFileId) return;
    setSaveState(dirtyFileIds[activeFileId] ? 'unsaved' : 'saved');
  }, [activeFileId, dirtyFileIds]);

  useEffect(() => {
    if (!autoSaveEnabled || !activeFileId || !dirtyFileIds[activeFileId]) return;
    const timer = setTimeout(() => {
      setSaveState('saving');
      saveFile(activeFileId, userName, 'manual', 'Auto save');
      setSaveState('saved');
    }, autoSaveSeconds * 1000);
    return () => clearTimeout(timer);
  }, [activeFileId, autoSaveEnabled, autoSaveSeconds, dirtyFileIds, saveFile, userName]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(v => !v);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (activeFileId) {
          setSaveState('saving');
          saveFile(activeFileId, userName, 'manual', 'Manual save');
          setSaveState('saved');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFileId, saveFile, userName]);

  useEffect(() => {
    return () => {
      if (naturalDebounceRef.current) clearTimeout(naturalDebounceRef.current);
      if (naturalBackfillDebounceRef.current) clearTimeout(naturalBackfillDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!aiFeedRef.current) return;
    aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight;
  }, [aiChatHistory, isAiChatLoading]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('natural-workspace', {
      base: darkMode ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': darkMode ? '#0b1220' : '#ffffff'
      }
    });
    monaco.editor.setTheme('natural-workspace');

    editor.onDidChangeCursorPosition((event) => {
      setCursor({ line: event.position.lineNumber, column: event.position.column });
      updateCursor(event.position.lineNumber, event.position.column);
    });

    editor.onDidChangeModelDecorations(() => {
      const model = editor.getModel();
      if (!model) return;
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      setErrorCount(computeErrorCount(markers));
    });
    if (linkedCodeRange) applyLinkedRangeDecoration(linkedCodeRange);
  };

  const applyLinkedRangeDecoration = (range: { startLine: number; endLine: number } | null) => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    if (editorRef.current) {
      linkedMainDecorationsRef.current = editorRef.current.deltaDecorations(
        linkedMainDecorationsRef.current,
        range
          ? [
              {
                range: new monaco.Range(range.startLine, 1, range.endLine, 1),
                options: { isWholeLine: true, className: 'natural-linked-section-line' }
              }
            ]
          : []
      );
    }
    if (naturalCodePreviewRef.current) {
      linkedNaturalPreviewDecorationsRef.current = naturalCodePreviewRef.current.deltaDecorations(
        linkedNaturalPreviewDecorationsRef.current,
        range
          ? [
              {
                range: new monaco.Range(range.startLine, 1, range.endLine, 1),
                options: { isWholeLine: true, className: 'natural-linked-section-line' }
              }
            ]
          : []
      );
    }
  };

  const handleNaturalEditorMount: OnMount = (editor) => {
    naturalEditorRef.current = editor;
    editor.onDidChangeCursorSelection((event) => {
      if (!activeFileId) return;
      const model = editor.getModel();
      if (!model) return;
      const start = model.getOffsetAt(event.selection.getStartPosition());
      const end = model.getOffsetAt(event.selection.getEndPosition());
      const maps = naturalMappings[activeFileId] || [];
      const hit = maps.find(item => !(end < item.englishStart || start > item.englishEnd));
      if (!hit) {
        setLinkedCodeRange(null);
        applyLinkedRangeDecoration(null);
        return;
      }
      const range = { startLine: hit.codeStartLine, endLine: hit.codeEndLine };
      setLinkedCodeRange(range);
      applyLinkedRangeDecoration(range);
    });
  };

  const handleNaturalCodePreviewMount: OnMount = (editor) => {
    naturalCodePreviewRef.current = editor;
    if (linkedCodeRange) applyLinkedRangeDecoration(linkedCodeRange);
  };

  const translateEnglishLineToCode = async (
    line: string,
    language: string,
    detail: TranslationDetail
  ) => {
    const cleanedInstruction = line
      .trim()
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+[\.\)]\s+/, '');
    if (!cleanedInstruction) return '';
    const cacheKey = `${language}:${detail}:${normalizeInstruction(cleanedInstruction)}`;
    const cached = naturalLineToCodeCacheRef.current[cacheKey];
    if (cached) return cached;
    const detailHint =
      detail === 'less'
        ? 'Use minimal concise code.'
        : detail === 'more'
          ? 'Generate robust and explicit code for this line.'
          : 'Generate balanced practical code for this line.';
    try {
      const prompt = [
        `Convert ONE English instruction into ${language} code.`,
        detailHint,
        'Return only code. No markdown fences. No explanation.',
        'Do not add unrelated features.',
        'Only implement this one instruction. Do not modify behavior for other instructions.',
        '',
        `Instruction: ${cleanedInstruction}`
      ].join('\n');
      const translated = cleanModelCode(await sendChatMessage([], prompt, 'qwen/qwen3-coder:free'));
      const fallback = compileEnglishLinesToCode([normalized], language as any).trim();
      const finalCode = (translated || fallback).trim();
      naturalLineToCodeCacheRef.current[cacheKey] = finalCode;
      return finalCode;
    } catch {
      return compileEnglishLinesToCode([normalized], language as any).trim();
    }
  };

  const translateCodeLineToEnglish = async (
    line: string,
    fileName: string,
    detail: TranslationDetail
  ) => {
    const normalized = line.trim();
    if (!normalized) return '';
    const cacheKey = `${fileName}:${detail}:${normalized}`;
    const cached = codeLineToNaturalCacheRef.current[cacheKey];
    if (cached) return cached;
    const pseudo = toPseudocodeLine(normalized, fileName, detail);
    codeLineToNaturalCacheRef.current[cacheKey] = pseudo;
    return pseudo;
  };

  const ensureEnglishFromCode = async (
    fileId: string,
    fileName: string,
    code: string,
    detail: TranslationDetail
  ) => {
    const source = code || '';
    if (!source.trim()) {
      setNaturalDocs(prev => ({ ...prev, [fileId]: 'This file is currently empty.' }));
      naturalSourceCodeRef.current[fileId] = source;
      return;
    }
    setIsBackTranslating(true);
    setNaturalTranslateMessage('Translating code lines to English...');
    try {
      const codeLines = source.split('\n');
      const htmlLike = inferFileKind(fileName) === 'html';
      let inStyle = false;
      let inScript = false;
      const englishLines: string[] = [];

      for (const rawLine of codeLines) {
        const line = rawLine.trim();
        if (!line) {
          englishLines.push('');
          continue;
        }

        if (htmlLike) {
          if (/^<style[^>]*>/i.test(line)) {
            inStyle = true;
            englishLines.push('Start a CSS style block for the page.');
            continue;
          }
          if (/^<\/style>/i.test(line)) {
            inStyle = false;
            englishLines.push('End the CSS style block.');
            continue;
          }
          if (/^<script[^>]*>/i.test(line)) {
            inScript = true;
            englishLines.push('Start a JavaScript logic block.');
            continue;
          }
          if (/^<\/script>/i.test(line)) {
            inScript = false;
            englishLines.push('End the JavaScript logic block.');
            continue;
          }

          if (inStyle) {
            englishLines.push(toPseudocodeLine(line, 'style.css', detail));
            continue;
          }
          if (inScript) {
            englishLines.push(toPseudocodeLine(line, 'app.js', detail));
            continue;
          }
        }

        englishLines.push(await translateCodeLineToEnglish(line, fileName, detail));
      }

      const compacted = englishLines.filter((entry, index) => {
        if (!entry.trim()) return false;
        if (entry === 'Add the next HTML structure line for the page.') return false;
        if (index > 0 && englishLines[index - 1] === entry) return false;
        return true;
      });
      const displayLines = compacted.map(line => (line && !line.startsWith('- ') ? `- ${line}` : line));
      const merged = displayLines.join('\n');
      setNaturalDocs(prev => ({ ...prev, [fileId]: merged || `Describe ${fileName} behavior.` }));
      naturalLineStateRef.current[fileId] = { englishLines: displayLines, lineCodes: codeLines };
      naturalSourceCodeRef.current[fileId] = source;
    } catch {
      const fallback = summarizeCodeToEnglish(source, fileName);
      setNaturalDocs(prev => ({ ...prev, [fileId]: fallback || `- Describe ${fileName} behavior in plain English.` }));
      naturalLineStateRef.current[fileId] = { englishLines: [], lineCodes: [] };
      naturalSourceCodeRef.current[fileId] = source;
    } finally {
      setIsBackTranslating(false);
      setNaturalTranslateMessage('');
    }
  };

  const updateNaturalDocument = (nextDoc: string) => {
    if (!activeFile || activeFile.type !== 'file') return;
    const fileId = activeFile.id;
    const language = detectLanguage(activeFile.name);
    setNaturalDocs(prev => ({ ...prev, [fileId]: nextDoc }));

    if (naturalDebounceRef.current) clearTimeout(naturalDebounceRef.current);

    if (!nextDoc.trim()) {
      setNaturalMappings(prev => ({ ...prev, [fileId]: [] }));
      naturalLineStateRef.current[fileId] = { englishLines: [], lineCodes: [] };
      updateFileContent(fileId, '', true);
      setSaveState('unsaved');
      setNaturalTranslateMessage('');
      return;
    }

    setNaturalTranslateMessage('Translating pseudocode to code...');
    naturalDebounceRef.current = setTimeout(async () => {
      const revision = naturalTranslateRevisionRef.current + 1;
      naturalTranslateRevisionRef.current = revision;
      setIsNaturalTranslating(true);

      const englishLines = nextDoc.split('\n');
      const previous = naturalLineStateRef.current[fileId] || { englishLines: [], lineCodes: [] };
      const lineCodes: string[] = [];
      const previousPools: Record<string, string[]> = {};
      previous.englishLines.forEach((oldLine, idx) => {
        const key = normalizeInstruction(oldLine || '');
        if (!key) return;
        if (!previousPools[key]) previousPools[key] = [];
        previousPools[key].push(previous.lineCodes[idx] || '');
      });

      for (let i = 0; i < englishLines.length; i += 1) {
        const currentLine = englishLines[i] || '';
        const normalizedCurrent = normalizeInstruction(currentLine);
        if (!normalizedCurrent) {
          lineCodes[i] = '';
          continue;
        }

        const sameAsPreviousIndex = normalizeInstruction(previous.englishLines[i] || '') === normalizedCurrent;
        if (sameAsPreviousIndex && previous.lineCodes[i] !== undefined) {
          lineCodes[i] = previous.lineCodes[i];
          continue;
        }

        const pooled = previousPools[normalizedCurrent];
        if (pooled && pooled.length > 0) {
          lineCodes[i] = pooled.shift() || '';
          continue;
        }

        lineCodes[i] = await translateEnglishLineToCode(currentLine, language, translationDetail);
      }
      if (naturalTranslateRevisionRef.current !== revision) return;

      const mapping: NaturalLineMap[] = [];
      let docOffset = 0;
      let codeLineCursor = 1;
      const codeOutLines: string[] = [];

      englishLines.forEach((line, idx) => {
        const lineStart = docOffset;
        const lineEnd = lineStart + line.length;
        const generated = lineCodes[idx] || '';
        const generatedLines = generated.split('\n');
        const safeGenerated = generatedLines.length ? generatedLines : [''];

        if (line.trim()) {
          mapping.push({
            englishStart: lineStart,
            englishEnd: Math.max(lineStart, lineEnd),
            codeStartLine: codeLineCursor,
            codeEndLine: codeLineCursor + safeGenerated.length - 1
          });
        }

        codeOutLines.push(...safeGenerated);
        codeLineCursor += safeGenerated.length;
        docOffset = lineEnd + (idx < englishLines.length - 1 ? 1 : 0);
      });

      const compiledCode = codeOutLines.join('\n');
      setNaturalMappings(prev => ({ ...prev, [fileId]: mapping }));
      naturalLineStateRef.current[fileId] = { englishLines, lineCodes };
      updateFileContent(fileId, compiledCode, true);
      naturalSourceCodeRef.current[fileId] = compiledCode;
      setSaveState('unsaved');
      setIsNaturalTranslating(false);
      setNaturalTranslateMessage(`Updated ${englishLines.length} line${englishLines.length === 1 ? '' : 's'}.`);
    }, 220);
  };

  useEffect(() => {
    if (editorMode !== 'natural' || !activeFile || activeFile.type !== 'file') return;
    const fileId = activeFile.id;
    const currentCode = activeFile.content || '';
    const existingEnglish = naturalDocs[fileId];
    const syncedSource = naturalSourceCodeRef.current[fileId];
    const needsBackfill = !existingEnglish || syncedSource !== currentCode;
    if (!needsBackfill) return;

    if (naturalBackfillDebounceRef.current) clearTimeout(naturalBackfillDebounceRef.current);
    naturalBackfillDebounceRef.current = setTimeout(() => {
      void ensureEnglishFromCode(fileId, activeFile.name, currentCode, translationDetail);
    }, 500);
  }, [editorMode, activeFileId, activeFile?.content, activeFile?.name, naturalDocs, translationDetail]);

  useEffect(() => {
    if (editorMode !== 'natural' || !activeFile || activeFile.type !== 'file') return;
    const currentDoc = naturalDocs[activeFile.id];
    if (!currentDoc || !currentDoc.trim()) return;
    updateNaturalDocument(currentDoc);
  }, [translationDetail]);

  const sendAiChat = async () => {
    const message = aiChatInput.trim();
    if (!message) return;
    setAiChatInput('');
    setAiChatHistory(prev => [...prev, { role: 'user', text: message }]);
    setIsAiChatLoading(true);
    try {
      const fileContext = activeFile
        ? `Active file: ${activeFile.name}\n\n${(activeFile.content || '').slice(0, 8000)}`
        : 'No active file.';
      const prompt = [
        message,
        '',
        'If user asks for code, return code blocks using fenced markdown.',
        'For multi-file output use fence headers with filename, e.g. ```html index.html',
        'If user asks a normal question, answer normally without code blocks.',
        'Never change unrelated logic when proposing edits.',
        '',
        'Context:',
        fileContext
      ].join('\n');
      const response = await sendChatMessage(aiChatHistory, prompt, 'nvidia/nemotron-nano-9b-v2:free');
      setAiChatHistory(prev => [...prev, { role: 'model', text: response }]);
      const blocks = parseAgentCodeBlocks(response);
      if (blocks.length > 0) {
        const proposals: AgentProposedChange[] = blocks.map((block, idx) => {
          const fallbackExt = block.lang || (activeFile?.language === 'html' ? 'html' : 'txt');
          const fallbackName = activeFile?.name || `agent-change-${idx + 1}.${fallbackExt}`;
          const requestedName = sanitizeFileName(block.fileHint, fallbackName);

          const exactPathTarget = Object.values(nodes).find(node => node.type === 'file' && getNodePath(nodes, node.id) === block.fileHint);
          const namedTarget = Object.values(nodes).find(node => node.type === 'file' && node.name === requestedName);
          const chosen = exactPathTarget || namedTarget || (idx === 0 ? activeFile : null);

          return {
            id: `${Date.now()}-${idx}`,
            fileId: chosen && chosen.type === 'file' ? chosen.id : null,
            fileName: chosen && chosen.type === 'file' ? chosen.name : requestedName,
            filePath: chosen && chosen.type === 'file' ? getNodePath(nodes, chosen.id) : requestedName,
            oldContent: chosen && chosen.type === 'file' ? (chosen.content || '') : '',
            newContent: block.code,
            isNewFile: !chosen
          };
        });
        setAgentProposedChanges(proposals);
      }
    } catch (err: any) {
      setAiChatHistory(prev => [...prev, { role: 'model', text: err?.message || 'AI chat failed.' }]);
    } finally {
      setIsAiChatLoading(false);
    }
  };

  const handleAgentQuickAction = (text: string) => {
    setAiChatInput(text);
  };

  const acceptAgentChanges = () => {
    if (agentProposedChanges.length === 0) return;
    const srcFolder = Object.values(nodes).find(node => node.type === 'folder' && node.name === 'src');
    const parentFolderId = srcFolder?.id || rootId;

    agentProposedChanges.forEach((change) => {
      let targetFileId = change.fileId;
      if (!targetFileId) {
        targetFileId = createNode(change.fileName, 'file', parentFolderId) || null;
      }
      if (!targetFileId) return;
      updateFileContent(targetFileId, change.newContent, true);
      setActiveFileId(targetFileId);
    });

    setSaveState('unsaved');
    setAgentProposedChanges([]);
  };

  const declineAgentChanges = () => {
    setAgentProposedChanges([]);
  };

  const askAgentForBetterChanges = () => {
    const scope = agentProposedChanges.map(change => change.fileName).join(', ');
    setAiChatInput(`Revise your last code proposal for ${scope}. Keep existing behavior stable and improve quality.`);
    setAgentProposedChanges([]);
  };

  const applyVisualEdit = (updates: { text?: string; color?: string; spacing?: string }) => {
    if (!activeFile || activeFile.type !== 'file' || !selectedElement?.line) return;
    const lines = (activeFile.content || '').split('\n');
    const index = selectedElement.line - 1;
    if (!lines[index]) return;

    let next = lines[index];
    if (updates.text) {
      next = next.replace(/>([^<]*)</, `>${updates.text}<`);
    }
    if (updates.color) {
      if (/style=/.test(next)) {
        next = next.replace(/style=["']([^"']*)["']/, (_, styles) => `style="${styles}; color:${updates.color};"`);
      } else {
        next = next.replace(/<([a-zA-Z0-9-]+)/, `<$1 style="color:${updates.color};"`);
      }
    }
    if (updates.spacing) {
      if (/style=/.test(next)) {
        next = next.replace(/style=["']([^"']*)["']/, (_, styles) => `style="${styles}; padding:${updates.spacing};"`);
      } else {
        next = next.replace(/<([a-zA-Z0-9-]+)/, `<$1 style="padding:${updates.spacing};"`);
      }
    }

    lines[index] = next;
    updateFileContent(activeFile.id, lines.join('\n'), true);
  };

  const activeFilePath = activeFile ? getNodePath(nodes, activeFile.id) : '';

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'bg-[#0f141d] text-[#e6edf3]' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`.natural-linked-section-line { background: rgba(16, 185, 129, 0.16); }`}</style>

      <TopBar
        projectName={projectName}
        collaborators={collaborators}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(v => !v)}
        onBack={onBack}
        onRun={() => {
          setShowRightPanel(true);
          setRightPanelTab('preview');
        }}
        onPublish={() => {
          if (!activeFileId) return;
          saveFile(activeFileId, userName, 'manual', 'Publish save');
          setSaveState('saved');
          setShowRightPanel(true);
          setRightPanelTab('preview');
        }}
        onSearch={() => {
          setShowRightPanel(true);
          setRightPanelTab('tools');
        }}
        onProfile={() => setCommandPaletteOpen(true)}
      />

      <div className="flex-1 min-h-0 flex">
        <aside className="w-[320px] min-w-[320px] border-r border-[#2a3140] bg-[#121923] flex flex-col min-h-0">
          <div className="h-11 px-3 border-b border-[#2a3140] flex items-center gap-2">
            <button onClick={() => setLeftPanelTab('agent')} className={`h-7 px-2.5 rounded-md text-xs border ${leftPanelTab === 'agent' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}>
              <span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Agent</span>
            </button>
            <button onClick={() => setLeftPanelTab('files')} className={`h-7 px-2.5 rounded-md text-xs border ${leftPanelTab === 'files' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}>
              <span className="inline-flex items-center gap-1"><FileCode2 className="w-3.5 h-3.5" /> Files</span>
            </button>
          </div>
          {leftPanelTab === 'files' ? (
            <div className="p-3 flex-1 min-h-0">
              <FileTreePanel
                nodes={nodes}
                rootId={rootId}
                activeFileId={activeFileId}
                dirtyFileIds={dirtyFileIds}
                onSelectFile={setActiveFileId}
                onToggleFolder={toggleFolder}
                onCreateNode={createNode}
                onRenameNode={renameNode}
                onDeleteNode={removeNode}
                onMoveNode={moveFileNode}
                embedded
              />
            </div>
          ) : (
            <>
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <div className="text-sm font-medium text-[#e8eef6]">AI Agent</div>
                <button onClick={() => setAiChatHistory([])} className="h-7 px-2 rounded-md border border-[#2a3140] text-xs text-[#c9d1d9] hover:bg-[#182131]">Clear</button>
              </div>
              <div className="px-3 pb-2 flex-1 min-h-0 flex flex-col">
                <div ref={aiFeedRef} className="flex-1 min-h-0 overflow-auto rounded-lg border border-[#2a3140] bg-[#0f141d] p-2 space-y-2">
                  {aiChatHistory.length === 0 && <div className="text-xs text-[#8190a3]">Ask questions or request code changes for the current project.</div>}
                  {aiChatHistory.map((msg, idx) => (
                    <div key={idx} className={`rounded-md px-2.5 py-2 text-xs whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#1b2536] text-[#d9e6ff]' : 'bg-[#161f2e] text-[#d2d9e0]'}`}>
                      <div className="text-[10px] mb-1 opacity-70">{msg.role === 'user' ? 'You' : 'Agent'}</div>
                      <div>{msg.text}</div>
                    </div>
                  ))}
                  {isAiChatLoading && <div className="text-xs text-[#8d96a0]">Thinking...</div>}
                </div>
              </div>
              {agentProposedChanges.length > 0 && (
                <div className="px-3 pb-2">
                  <div className="rounded-lg border border-[#2a3140] bg-[#0f141d] p-2.5">
                    <div className="text-xs font-semibold text-[#dbe4ef]">Proposed changes</div>
                    <div className="mt-2 space-y-1 max-h-44 overflow-auto">
                      {agentProposedChanges.map((change) => (
                        <div key={change.id} className="rounded border border-[#2a3140] p-1.5">
                          <div className="text-[11px] text-[#cfd8e3] mb-1">{change.filePath}</div>
                          <div className="max-h-24 overflow-auto rounded border border-[#2a3140] bg-[#0b111a] p-1 text-[10px] font-mono space-y-0.5">
                            {buildMiniDiff(change.oldContent, change.newContent).slice(0, 24).map((line, idx) => (
                              <div
                                key={`${change.id}-${idx}`}
                                className={
                                  line.kind === 'added'
                                    ? 'text-emerald-300 bg-emerald-500/10 px-1'
                                    : line.kind === 'removed'
                                      ? 'text-red-300 bg-red-500/10 px-1'
                                      : 'text-[#8d96a0] px-1'
                                }
                              >
                                {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '} {line.text || ' '}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={acceptAgentChanges} className="h-7 px-2.5 rounded-md bg-[#2563eb] text-white text-[11px]">Accept</button>
                      <button onClick={declineAgentChanges} className="h-7 px-2.5 rounded-md border border-[#2a3140] text-[#d2d9e0] text-[11px] hover:bg-[#182131]">Decline</button>
                      <button onClick={askAgentForBetterChanges} className="h-7 px-2.5 rounded-md border border-[#2a3140] text-[#d2d9e0] text-[11px] hover:bg-[#182131]">Ask better</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-3 pb-3 mt-auto">
                <div className="rounded-lg border border-[#2a3140] bg-[#0f141d] p-2">
                  <textarea
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    placeholder="Ask AI..."
                    className="w-full h-16 resize-none bg-transparent text-sm text-[#e6edf3] placeholder-[#728194] outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendAiChat();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleAgentQuickAction('Improve the current file and explain what changed')} className="h-6 w-6 rounded border border-[#2a3140] text-[#cbd5e1] flex items-center justify-center hover:bg-[#182131]"><Sparkles className="w-3 h-3" /></button>
                      <button onClick={() => setCommandPaletteOpen(true)} className="h-6 w-6 rounded border border-[#2a3140] text-[#cbd5e1] flex items-center justify-center hover:bg-[#182131]"><Wrench className="w-3 h-3" /></button>
                    </div>
                    <button onClick={sendAiChat} disabled={isAiChatLoading || !aiChatInput.trim()} className="h-6 w-6 rounded bg-[#2563eb] text-white disabled:opacity-40 flex items-center justify-center">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-[#0f141d]">
          <div className="h-10 border-b border-[#2a3140] px-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-8 px-3 rounded-t-md bg-[#161f2e] border border-b-0 border-[#2a3140] text-[#e6edf3] text-sm flex items-center truncate max-w-[340px]">
                <FileCode2 className="w-3.5 h-3.5 text-[#8da2c0] mr-1.5" />
                {activeFilePath || 'index.html'}
              </div>
              <button
                className="h-8 px-3 rounded-t-md bg-[#121923] border border-b-0 border-[#2a3140] text-[#c9d1d9] text-sm hover:bg-[#182131]"
                onClick={() => setShowRightPanel(v => !v)}
              >
                Tools & files
              </button>
              <button
                onClick={() => createNode('new-file.ts', 'file', rootId)}
                className="h-8 w-8 rounded-md text-[#8d96a0] hover:bg-[#182131] flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setShowRightPanel(true); setRightPanelTab('tools'); }} className="h-7 w-7 rounded-md text-[#8d96a0] hover:bg-[#182131] flex items-center justify-center"><Search className="w-3.5 h-3.5" /></button>
              <button onClick={() => setCommandPaletteOpen(true)} className="h-7 w-7 rounded-md text-[#8d96a0] hover:bg-[#182131] flex items-center justify-center"><MoreHorizontal className="w-3.5 h-3.5" /></button>
              <button
                className={`h-7 px-2 text-[11px] rounded-md border ${editorMode === 'code' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}
                onClick={() => setEditorMode('code')}
              >
                Code
              </button>
              <button
                className={`h-7 px-2 text-[11px] rounded-md border ${editorMode === 'natural' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}
                onClick={() => setEditorMode('natural')}
              >
                Natural
              </button>
            </div>
          </div>

          {editorMode === 'code' && activeFile && activeFile.type === 'file' ? (
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={mapLanguage(activeFile.language)}
                value={activeFile.content || ''}
                onMount={handleEditorMount}
                onChange={(value) => {
                  updateFileContent(activeFile.id, value || '', true);
                  setSaveState('unsaved');
                }}
                options={{
                  minimap: { enabled: false },
                  glyphMargin: true,
                  folding: true,
                  stickyScroll: { enabled: true },
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  quickSuggestions: true,
                  suggest: { preview: true, showIcons: true },
                  inlineSuggest: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: 21,
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  bracketPairColorization: { enabled: true },
                  suggestOnTriggerCharacters: true,
                  tabSize: 2,
                  renderWhitespace: 'selection',
                  readOnly: false
                }}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex">
              <div className="w-1/2 border-r border-[#2b3035] flex flex-col">
                <div className="h-9 border-b border-[#2b3035] px-3 flex items-center justify-between bg-[#0f1113]">
                  <span className="text-xs text-[#8d96a0]">English Editor</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={translationDetail}
                      onChange={(e) => setTranslationDetail(e.target.value as TranslationDetail)}
                      className="h-6 px-2 rounded border border-[#2b3035] bg-[#0b0d0f] text-[11px] text-[#e6edf3]"
                      title="Translation detail level"
                    >
                      <option value="less">Less detail</option>
                      <option value="balanced">Balanced</option>
                      <option value="more">More detail</option>
                    </select>
                    <span className="text-[11px] text-[#6f7a86]">
                      {isBackTranslating
                        ? 'Converting code to English...'
                        : isNaturalTranslating
                          ? 'AI translating...'
                          : (naturalTranslateMessage || 'Select a line to highlight code mapping')}
                    </span>
                  </div>
                </div>
                <MonacoEditor
                  height="100%"
                  language="plaintext"
                  value={naturalDocs[activeFileId] || ''}
                  onMount={handleNaturalEditorMount}
                  onChange={(value) => updateNaturalDocument(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 21,
                    automaticLayout: true,
                    tabSize: 2
                  }}
                />
              </div>
              <div className="w-1/2 flex flex-col">
                <div className="h-9 border-b border-[#2b3035] px-3 flex items-center justify-between bg-[#0f1113]">
                  <span className="text-xs text-[#8d96a0]">Generated Code</span>
                  <span className="text-[11px] text-[#6f7a86]">
                    {linkedCodeRange ? `Highlighted lines ${linkedCodeRange.startLine}-${linkedCodeRange.endLine}` : 'No section selected'}
                  </span>
                </div>
                <MonacoEditor
                  height="100%"
                  language={mapLanguage(activeFile?.language)}
                  value={activeFile?.content || ''}
                  onMount={handleNaturalCodePreviewMount}
                  options={{
                    minimap: { enabled: false },
                    readOnly: true,
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 21,
                    automaticLayout: true,
                    tabSize: 2
                  }}
                />
              </div>
            </div>
          )}
        </main>

        {showRightPanel && <aside className="w-[380px] min-w-[380px] bg-[#121923] border-l border-[#2a3140] flex flex-col">
          <div className="h-10 border-b border-[#2a3140] px-3 flex items-center gap-2">
            <button onClick={() => setRightPanelTab('tools')} className={`h-7 px-2.5 text-xs rounded-md border ${rightPanelTab === 'tools' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}>
              <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Tools</span>
            </button>
            <button onClick={() => setRightPanelTab('preview')} className={`h-7 px-2.5 text-xs rounded-md border ${rightPanelTab === 'preview' ? 'bg-[#1b2536] border-[#35507a] text-[#9dc4ff]' : 'border-[#2a3140] text-[#c9d1d9] hover:bg-[#182131]'}`}>
              <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Preview</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
            {rightPanelTab === 'tools' && (
              <FileTreePanel
                nodes={nodes}
                rootId={rootId}
                activeFileId={activeFileId}
                dirtyFileIds={dirtyFileIds}
                onSelectFile={setActiveFileId}
                onToggleFolder={toggleFolder}
                onCreateNode={createNode}
                onRenameNode={renameNode}
                onDeleteNode={removeNode}
                onMoveNode={moveFileNode}
                embedded
              />
            )}
            {rightPanelTab === 'preview' && (
              <PreviewPanel
                html={previewHtml}
                selectedElementLine={selectedElement?.line || null}
                onSelectElement={(payload) => {
                  const file = Object.values(nodes).find(node => node.type === 'file' && node.name.endsWith('.html'));
                  const line = file?.content ? findSnippetLine(file.content, payload.snippet) : null;
                  setSelectedElement({ ...payload, line });
                  if (file && line) setActiveFileId(file.id);
                }}
              />
            )}
          </div>
        </aside>}
      </div>

      <BottomBar
        language={activeFile?.language || 'plaintext'}
        errorCount={errorCount}
        isConnected={true}
        saveState={saveState}
      />

      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center pt-24" onClick={() => setCommandPaletteOpen(false)}>
          <div className="w-[640px] bg-[#111316] rounded-xl border border-[#2b3035] shadow-xl p-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-[#e6edf3] mb-2">Command Palette</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="h-9 rounded border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]" onClick={() => setEditorMode('natural')}>Switch to Natural Mode</button>
              <button className="h-9 rounded border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]" onClick={() => setEditorMode('code')}>Switch to Code Mode</button>
              <button className="h-9 rounded border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]" onClick={() => activeFileId && saveFile(activeFileId, userName, 'manual', 'Palette save')}>Save Active File</button>
              <button className="h-9 rounded border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]" onClick={() => setAutoSaveEnabled(v => !v)}>Toggle Auto-save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
