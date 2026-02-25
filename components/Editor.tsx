import React, { useCallback } from 'react';
import MonacoEditor, { OnChange, OnMount } from '@monaco-editor/react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  language?: string;
  wordWrapEnabled?: boolean;
  onSaveShortcut?: () => void;
  onRunShortcut?: () => void;
  onConvertShortcut?: () => void;
  onFormatShortcut?: () => void;
  disabled?: boolean;
}

const mapLanguage = (language?: string) => {
  if (!language) return 'plaintext';
  const normalized = language.toLowerCase();
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'py') return 'python';
  if (normalized === 'md') return 'markdown';
  if (normalized === 'en') return 'plaintext';
  if (normalized === 'htm') return 'html';
  return normalized;
};

export const Editor: React.FC<EditorProps> = ({
  value,
  onChange,
  onCursorChange,
  language,
  wordWrapEnabled,
  onSaveShortcut,
  onRunShortcut,
  onConvertShortcut,
  onFormatShortcut,
  disabled
}) => {
  const handleChange: OnChange = useCallback(
    (nextValue) => {
      onChange(nextValue || '');
    },
    [onChange]
  );

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      monaco.editor.defineTheme('natural-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280' },
          { token: 'keyword', foreground: '60a5fa' },
          { token: 'string', foreground: '34d399' },
          { token: 'number', foreground: 'f59e0b' }
        ],
        colors: {
          'editor.background': '#0e1011',
          'editorLineNumber.foreground': '#4b5563',
          'editorLineNumber.activeForeground': '#cbd5e1',
          'editorCursor.foreground': '#ffffff',
          'editor.selectionBackground': '#1f2937',
          'editor.inactiveSelectionBackground': '#111827',
          'editorIndentGuide.background1': '#1f2937',
          'editorIndentGuide.activeBackground1': '#334155'
        }
      });
      monaco.editor.setTheme('natural-dark');

      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.(e.position.lineNumber, e.position.column);
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSaveShortcut?.();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunShortcut?.();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
        onConvertShortcut?.();
      });

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction('editor.action.formatDocument')?.run();
        onFormatShortcut?.();
      });

      const initial = editor.getPosition();
      if (initial) {
        onCursorChange?.(initial.lineNumber, initial.column);
      }
    },
    [onConvertShortcut, onCursorChange, onFormatShortcut, onRunShortcut, onSaveShortcut]
  );

  return (
    <div className="h-full w-full bg-[#0e1011]">
      <MonacoEditor
        height="100%"
        width="100%"
        language={mapLanguage(language)}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          readOnly: !!disabled,
          minimap: { enabled: false },
          lineNumbers: 'on',
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
          fontSize: 13,
          lineHeight: 20,
          roundedSelection: true,
          cursorBlinking: 'blink',
          renderWhitespace: 'selection',
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          wordWrap: wordWrapEnabled ? 'on' : 'off',
          padding: { top: 14 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          }
        }}
      />
    </div>
  );
};
