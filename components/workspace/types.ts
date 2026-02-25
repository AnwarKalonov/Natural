export type WorkspaceLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'sql'
  | 'plaintext';

export type WorkspaceNodeType = 'file' | 'folder';

export interface WorkspaceFileNode {
  id: string;
  name: string;
  type: WorkspaceNodeType;
  parentId: string | null;
  children?: string[];
  content?: string;
  language?: WorkspaceLanguage;
  isOpen?: boolean;
}

export interface WorkspaceComment {
  id: string;
  fileId: string;
  line: number;
  message: string;
  author: string;
  createdAt: number;
}

export interface WorkspaceVersion {
  id: string;
  fileId: string;
  actor: string;
  source: 'manual' | 'ai';
  summary: string;
  timestamp: number;
  content: string;
}

export interface AiDiffLine {
  kind: 'added' | 'removed' | 'unchanged';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  text: string;
}

export interface PendingAiChange {
  id: string;
  fileId: string;
  scope: 'selection' | 'file' | 'project';
  action: string;
  summary: string;
  oldContent: string;
  newContent: string;
  diff: AiDiffLine[];
}

export interface CollaboratorState {
  id: string;
  name: string;
  color: string;
  fileId: string | null;
  cursorLine: number;
  cursorColumn: number;
  updatedAt: number;
}
