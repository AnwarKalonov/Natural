import { WorkspaceFileNode, WorkspaceLanguage } from '../types';

export const makeId = () => Math.random().toString(36).slice(2, 11);

export const detectLanguage = (filename: string): WorkspaceLanguage => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'py') return 'python';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (ext === 'sql') return 'sql';
  return 'plaintext';
};

export const createStarterTree = () => {
  const rootId = makeId();
  const srcId = makeId();
  const htmlId = makeId();
  const cssId = makeId();
  const jsId = makeId();

  const nodes: Record<string, WorkspaceFileNode> = {
    [rootId]: {
      id: rootId,
      name: 'project',
      type: 'folder',
      parentId: null,
      children: [srcId],
      isOpen: true
    },
    [srcId]: {
      id: srcId,
      name: 'src',
      type: 'folder',
      parentId: rootId,
      children: [htmlId, cssId, jsId],
      isOpen: true
    },
    [htmlId]: {
      id: htmlId,
      name: 'index.html',
      type: 'file',
      parentId: srcId,
      content: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Natural Workspace</title>\n  <link rel="stylesheet" href="./styles.css" />\n</head>\n<body>\n  <div id="app">\n    <h1>Natural</h1>\n    <p>Production-ready collaborative workspace.</p>\n  </div>\n  <script src="./app.js"></script>\n</body>\n</html>\n',
      language: 'html'
    },
    [cssId]: {
      id: cssId,
      name: 'styles.css',
      type: 'file',
      parentId: srcId,
      content: ':root {\n  color-scheme: light dark;\n}\n\nbody {\n  margin: 0;\n  font-family: Inter, system-ui, sans-serif;\n  background: #f7f8fb;\n  color: #111827;\n}\n\n#app {\n  max-width: 880px;\n  margin: 40px auto;\n  background: #fff;\n  padding: 24px;\n  border-radius: 14px;\n  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);\n}\n',
      language: 'css'
    },
    [jsId]: {
      id: jsId,
      name: 'app.js',
      type: 'file',
      parentId: srcId,
      content: 'const root = document.querySelector("#app");\n\nif (root) {\n  console.log("Natural workspace loaded");\n}\n',
      language: 'javascript'
    }
  };

  return { nodes, rootId, defaultFileId: htmlId };
};

export const getNodePath = (nodes: Record<string, WorkspaceFileNode>, nodeId: string): string => {
  const parts: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    const node = nodes[cursor];
    if (!node) break;
    if (node.parentId !== null) parts.unshift(node.name);
    cursor = node.parentId;
  }
  return parts.join('/');
};

export const moveNode = (
  nodes: Record<string, WorkspaceFileNode>,
  sourceId: string,
  destinationFolderId: string
): Record<string, WorkspaceFileNode> => {
  const source = nodes[sourceId];
  const destination = nodes[destinationFolderId];
  if (!source || !destination || destination.type !== 'folder' || source.parentId === null) return nodes;
  if (sourceId === destinationFolderId) return nodes;

  const sourceParent = nodes[source.parentId];
  if (!sourceParent || sourceParent.type !== 'folder') return nodes;

  const next = { ...nodes };
  next[sourceParent.id] = {
    ...sourceParent,
    children: (sourceParent.children || []).filter(id => id !== sourceId)
  };
  next[destinationFolderId] = {
    ...destination,
    isOpen: true,
    children: [...(destination.children || []), sourceId]
  };
  next[sourceId] = {
    ...source,
    parentId: destinationFolderId
  };
  return next;
};

export const flattenTree = (
  nodes: Record<string, WorkspaceFileNode>,
  rootId: string,
  depth = 0
): Array<{ node: WorkspaceFileNode; depth: number }> => {
  const root = nodes[rootId];
  if (!root) return [];
  const out: Array<{ node: WorkspaceFileNode; depth: number }> = [{ node: root, depth }];
  if (root.type !== 'folder' || !root.isOpen) return out;
  for (const childId of root.children || []) {
    out.push(...flattenTree(nodes, childId, depth + 1));
  }
  return out;
};
