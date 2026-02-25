import { useState } from 'react';
import { sendChatMessage } from '../../../services/geminiService';
import { AiDiffLine, PendingAiChange, WorkspaceFileNode } from '../types';

const makeId = () => Math.random().toString(36).slice(2, 11);

const createLineDiff = (oldText: string, newText: string): AiDiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const lines: AiDiffLine[] = [];
  for (let i = 0; i < max; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      lines.push({
        kind: 'unchanged',
        oldLineNumber: oldLine !== undefined ? i + 1 : null,
        newLineNumber: newLine !== undefined ? i + 1 : null,
        text: oldLine || newLine || ''
      });
      continue;
    }
    if (oldLine !== undefined) {
      lines.push({
        kind: 'removed',
        oldLineNumber: i + 1,
        newLineNumber: null,
        text: oldLine
      });
    }
    if (newLine !== undefined) {
      lines.push({
        kind: 'added',
        oldLineNumber: null,
        newLineNumber: i + 1,
        text: newLine
      });
    }
  }
  return lines;
};

export const useAiEditorActions = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAiAction = async (params: {
    action: string;
    scope: 'selection' | 'file' | 'project';
    instruction: string;
    file: WorkspaceFileNode;
    selectedCode: string;
    projectFiles: WorkspaceFileNode[];
  }): Promise<PendingAiChange | null> => {
    if (!params.file.content) return null;

    setIsRunning(true);
    setError(null);

    try {
      const isSelection = params.scope === 'selection' && params.selectedCode.trim().length > 0;
      const targetCode = isSelection ? params.selectedCode : (params.file.content || '');

      const projectContext = params.projectFiles
        .filter(file => file.type === 'file')
        .map(file => `FILE: ${file.name}\n${file.content || ''}`)
        .join('\n\n');

      const prompt = [
        `Action: ${params.action}`,
        `Scope: ${params.scope}`,
        `Instruction: ${params.instruction}`,
        'Rules:',
        '- Return only updated code. No markdown fences.',
        '- Preserve existing style and conventions.',
        '- Apply minimal incremental edits. Do not rewrite unrelated code.',
        '- Never remove unrelated imports, components, or functions.',
        '',
        params.scope === 'project' ? `Project context:\n${projectContext}` : '',
        'Target code:',
        targetCode
      ].filter(Boolean).join('\n');

      const raw = await sendChatMessage([], prompt, 'qwen/qwen3-coder:free');
      const cleaned = raw.replace(/^```[\w-]*\n?/g, '').replace(/```$/g, '').trim();
      const nextCode = cleaned || targetCode;

      const newFileContent = isSelection
        ? (params.file.content || '').replace(params.selectedCode, nextCode)
        : nextCode;

      return {
        id: makeId(),
        fileId: params.file.id,
        scope: params.scope,
        action: params.action,
        summary: `${params.action} (${params.scope})`,
        oldContent: params.file.content || '',
        newContent: newFileContent,
        diff: createLineDiff(params.file.content || '', newFileContent)
      };
    } catch (err: any) {
      setError(err?.message || 'AI action failed.');
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  const askClarifyingQuestion = (instruction: string) => {
    const text = instruction.trim();
    if (text.length > 32 && text.split(' ').length > 6) return null;
    return 'Can you clarify target file, expected behavior, and edge cases before generating code?';
  };

  return {
    isRunning,
    error,
    runAiAction,
    askClarifyingQuestion
  };
};
