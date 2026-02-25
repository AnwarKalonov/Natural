import { useMemo, useState } from 'react';
import { WorkspaceFileNode, WorkspaceVersion } from '../types';
import { createStarterTree, detectLanguage, makeId, moveNode } from '../utils/fileTree';

export const useWorkspaceFiles = () => {
  const starter = useMemo(() => createStarterTree(), []);
  const [nodes, setNodes] = useState<Record<string, WorkspaceFileNode>>(starter.nodes);
  const [rootId] = useState(starter.rootId);
  const [activeFileId, setActiveFileId] = useState(starter.defaultFileId);
  const [dirtyFileIds, setDirtyFileIds] = useState<Record<string, boolean>>({});
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);

  const activeFile = nodes[activeFileId] || null;

  const createNode = (name: string, type: 'file' | 'folder', parentId: string) => {
    const parent = nodes[parentId];
    if (!parent || parent.type !== 'folder') return null;
    const id = makeId();
    const nextNode: WorkspaceFileNode = {
      id,
      name,
      type,
      parentId,
      children: type === 'folder' ? [] : undefined,
      content: type === 'file' ? '' : undefined,
      language: type === 'file' ? detectLanguage(name) : undefined,
      isOpen: type === 'folder' ? true : undefined
    };

    setNodes(prev => ({
      ...prev,
      [id]: nextNode,
      [parentId]: {
        ...prev[parentId],
        isOpen: true,
        children: [...(prev[parentId].children || []), id]
      }
    }));

    if (type === 'file') setActiveFileId(id);
    return id;
  };

  const renameNode = (id: string, name: string) => {
    setNodes(prev => {
      const node = prev[id];
      if (!node) return prev;
      return {
        ...prev,
        [id]: {
          ...node,
          name,
          language: node.type === 'file' ? detectLanguage(name) : node.language
        }
      };
    });
  };

  const removeNode = (id: string) => {
    setNodes(prev => {
      const node = prev[id];
      if (!node || node.parentId === null) return prev;
      const next = { ...prev };

      const removeRecursive = (nodeId: string) => {
        const target = next[nodeId];
        if (!target) return;
        if (target.type === 'folder') {
          for (const childId of target.children || []) removeRecursive(childId);
        }
        delete next[nodeId];
      };

      removeRecursive(id);
      const parent = next[node.parentId];
      if (parent && parent.type === 'folder') {
        next[parent.id] = {
          ...parent,
          children: (parent.children || []).filter(childId => childId !== id)
        };
      }
      return next;
    });

    setDirtyFileIds(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (activeFileId === id) {
      const fallback = Object.values(nodes).find(node => node.type === 'file' && node.id !== id);
      if (fallback) setActiveFileId(fallback.id);
    }
  };

  const moveFileNode = (sourceId: string, destinationFolderId: string) => {
    setNodes(prev => moveNode(prev, sourceId, destinationFolderId));
  };

  const toggleFolder = (id: string) => {
    setNodes(prev => {
      const node = prev[id];
      if (!node || node.type !== 'folder') return prev;
      return { ...prev, [id]: { ...node, isOpen: !node.isOpen } };
    });
  };

  const updateFileContent = (fileId: string, content: string, markDirty = true) => {
    setNodes(prev => {
      const file = prev[fileId];
      if (!file || file.type !== 'file') return prev;
      return {
        ...prev,
        [fileId]: {
          ...file,
          content
        }
      };
    });
    if (markDirty) {
      setDirtyFileIds(prev => ({ ...prev, [fileId]: true }));
    }
  };

  const saveFile = (fileId: string, actor: string, source: 'manual' | 'ai', summary: string) => {
    const file = nodes[fileId];
    if (!file || file.type !== 'file') return;
    setDirtyFileIds(prev => ({ ...prev, [fileId]: false }));
    setVersions(prev => [
      {
        id: makeId(),
        fileId,
        actor,
        source,
        summary,
        timestamp: Date.now(),
        content: file.content || ''
      },
      ...prev
    ].slice(0, 200));
  };

  const revertToVersion = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    updateFileContent(version.fileId, version.content, false);
    setDirtyFileIds(prev => ({ ...prev, [version.fileId]: false }));
    setActiveFileId(version.fileId);
  };

  return {
    nodes,
    rootId,
    activeFileId,
    setActiveFileId,
    activeFile,
    dirtyFileIds,
    versions,
    createNode,
    renameNode,
    removeNode,
    moveFileNode,
    toggleFolder,
    updateFileContent,
    saveFile,
    revertToVersion
  };
};
