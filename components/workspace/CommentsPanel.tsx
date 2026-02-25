import React, { useState } from 'react';
import { WorkspaceComment } from './types';

interface CommentsPanelProps {
  comments: WorkspaceComment[];
  currentLine: number;
  activeFileId: string;
  userName: string;
  onAddComment: (message: string, line: number) => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments,
  currentLine,
  activeFileId,
  userName,
  onAddComment
}) => {
  const [input, setInput] = useState('');
  const filtered = comments.filter(item => item.fileId === activeFileId);

  return (
    <section className="rounded-xl border border-[#2b3035] bg-[#111316] p-3 shadow-sm">
      <div className="text-sm font-semibold text-[#e6edf3] mb-2">Line Comments</div>
      <div className="text-[11px] text-[#8d96a0] mb-2">Use @username mentions for teammates.</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          onAddComment(input.trim(), currentLine);
          setInput('');
        }}
        className="flex gap-2 mb-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Comment on line ${currentLine}`}
          className="flex-1 h-8 rounded-md border border-[#2b3035] bg-[#0b0d0f] text-[#e6edf3] px-2 text-xs outline-none focus:border-blue-500"
        />
        <button className="h-8 px-3 rounded-md bg-blue-600 text-white text-xs">Add</button>
      </form>
      <div className="max-h-44 overflow-auto space-y-1.5">
        {filtered.length === 0 && <div className="text-[11px] text-[#8d96a0]">No comments yet.</div>}
        {filtered.map(comment => (
          <div key={comment.id} className="rounded-md border border-[#2b3035] p-2">
            <div className="text-[11px] text-[#e6edf3] font-medium">
              {comment.author} • line {comment.line}
            </div>
            <div className="text-[11px] text-[#bac4ce] mt-0.5">{comment.message}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[#7f8b97] mt-2">Signed in as {userName}</div>
    </section>
  );
};
