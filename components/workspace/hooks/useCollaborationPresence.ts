import { useEffect, useMemo, useState } from 'react';
import { CollaboratorState } from '../types';

const CHANNEL = 'natural-workspace-presence';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

const makeId = () => Math.random().toString(36).slice(2, 11);

export const useCollaborationPresence = (userName: string, activeFileId: string | null) => {
  const selfId = useMemo(() => makeId(), []);
  const selfColor = useMemo(() => COLORS[Math.floor(Math.random() * COLORS.length)], []);
  const [collaborators, setCollaborators] = useState<Record<string, CollaboratorState>>({});

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);

    const publish = (cursorLine = 1, cursorColumn = 1) => {
      const payload: CollaboratorState = {
        id: selfId,
        name: userName,
        color: selfColor,
        fileId: activeFileId,
        cursorLine,
        cursorColumn,
        updatedAt: Date.now()
      };
      channel.postMessage(payload);
      setCollaborators(prev => ({ ...prev, [selfId]: payload }));
    };

    const interval = setInterval(() => publish(), 5000);
    publish();

    channel.onmessage = (event) => {
      const payload = event.data as CollaboratorState;
      if (!payload || !payload.id) return;
      setCollaborators(prev => ({ ...prev, [payload.id]: payload }));
    };

    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, [activeFileId, selfColor, selfId, userName]);

  const updateCursor = (line: number, column: number) => {
    const channel = new BroadcastChannel(CHANNEL);
    const payload: CollaboratorState = {
      id: selfId,
      name: userName,
      color: selfColor,
      fileId: activeFileId,
      cursorLine: line,
      cursorColumn: column,
      updatedAt: Date.now()
    };
    channel.postMessage(payload);
    setCollaborators(prev => ({ ...prev, [selfId]: payload }));
    channel.close();
  };

  const activeCollaborators = Object.values(collaborators)
    .filter(c => Date.now() - c.updatedAt < 25000)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    selfId,
    selfColor,
    collaborators: activeCollaborators,
    updateCursor
  };
};
