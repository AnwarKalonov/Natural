import React, { useMemo, useState } from 'react';
import { WorkspaceFileNode } from './types';
import { flattenTree } from './utils/fileTree';

interface FileTreePanelProps {
  nodes: Record<string, WorkspaceFileNode>;
  rootId: string;
  activeFileId: string;
  dirtyFileIds: Record<string, boolean>;
  onSelectFile: (fileId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateNode: (name: string, type: 'file' | 'folder', parentId: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onDeleteNode: (id: string) => void;
  onMoveNode: (sourceId: string, destinationFolderId: string) => void;
  embedded?: boolean;
}

export const FileTreePanel: React.FC<FileTreePanelProps> = ({
  nodes,
  rootId,
  activeFileId,
  dirtyFileIds,
  onSelectFile,
  onToggleFolder,
  onCreateNode,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  embedded = false
}) => {
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const items = useMemo(() => flattenTree(nodes, rootId, -1).filter(item => item.node.id !== rootId), [nodes, rootId]);

  return (
    <aside className={`${embedded ? 'w-full border border-[#2b3035] rounded-lg bg-[#0f1113]' : 'w-72 border-r border-[#2b3035] bg-[#0f1113]'} h-full overflow-hidden flex flex-col`}>
      <div className="h-11 px-3 border-b border-[#2b3035] flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[#8d96a0] font-semibold">Files</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setCreateParentId(rootId);
              setCreateType('file');
            }}
            className="h-7 px-2 text-xs rounded-md border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]"
          >
            + File
          </button>
          <button
            onClick={() => {
              setCreateParentId(rootId);
              setCreateType('folder');
            }}
            className="h-7 px-2 text-xs rounded-md border border-[#2b3035] text-[#d2d9e0] hover:bg-[#1b1f23]"
          >
            + Folder
          </button>
        </div>
      </div>

      {createParentId && (
        <form
          className="p-2 border-b border-[#2b3035]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            onCreateNode(newName.trim(), createType, createParentId);
            setCreateParentId(null);
            setNewName('');
          }}
        >
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              placeholder={createType === 'file' ? 'filename.ext' : 'folder'}
              className="flex-1 h-8 rounded-md border border-[#2b3035] bg-[#0b0d0f] text-[#e6edf3] px-2 text-xs outline-none focus:border-blue-500"
            />
            <button className="h-8 px-2 text-xs rounded-md bg-blue-600 text-white">Create</button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto p-1">
        {items.map(({ node, depth }) => {
          const isActive = node.id === activeFileId;
          const isDirty = !!dirtyFileIds[node.id];
          return (
            <div
              key={node.id}
              className={`group flex items-center gap-2 h-8 rounded-md px-2 text-sm ${isActive ? 'bg-[#1d2a42] text-[#9dc4ff]' : 'hover:bg-[#1b1f23] text-[#c9d1d9]'}`}
              style={{ paddingLeft: `${Math.max(0, depth) * 14 + 8}px` }}
              draggable
              onDragStart={() => setDragId(node.id)}
              onDragOver={(e) => {
                if (node.type === 'folder') e.preventDefault();
              }}
              onDrop={() => {
                if (dragId && node.type === 'folder') onMoveNode(dragId, node.id);
                setDragId(null);
              }}
            >
              {node.type === 'folder' ? (
                <button className="text-[#8d96a0]" onClick={() => onToggleFolder(node.id)}>
                  {node.isOpen ? '▾' : '▸'}
                </button>
              ) : (
                <span className="text-[#5f6b76]">•</span>
              )}

              {renameId === node.id ? (
                <form
                  className="flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!renameValue.trim()) return;
                    onRenameNode(node.id, renameValue.trim());
                    setRenameId(null);
                  }}
                >
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="w-full h-6 rounded border border-[#2b3035] bg-[#0b0d0f] text-[#e6edf3] px-1 text-xs"
                  />
                </form>
              ) : (
                <button
                  onClick={() => {
                    if (node.type === 'file') onSelectFile(node.id);
                    else onToggleFolder(node.id);
                  }}
                  className="flex-1 text-left truncate"
                >
                  {node.name}
                </button>
              )}

              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}

              {node.id !== rootId && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    className="text-[10px] px-1 py-0.5 rounded hover:bg-[#2b3035] text-[#b5bec8]"
                    onClick={() => {
                      setRenameId(node.id);
                      setRenameValue(node.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="text-[10px] px-1 py-0.5 rounded hover:bg-red-500/20 text-red-300"
                    onClick={() => onDeleteNode(node.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
