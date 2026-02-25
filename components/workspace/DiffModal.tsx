import React from 'react';
import { PendingAiChange } from './types';

interface DiffModalProps {
  change: PendingAiChange | null;
  onClose: () => void;
  onApply: (change: PendingAiChange) => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({ change, onClose, onApply }) => {
  if (!change) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl h-[80vh] bg-[#111316] rounded-2xl border border-[#2b3035] shadow-2xl flex flex-col overflow-hidden">
        <div className="h-12 border-b border-[#2b3035] px-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#e6edf3]">AI Diff Preview</div>
            <div className="text-xs text-[#8d96a0]">{change.summary}</div>
          </div>
          <button className="text-xs px-2.5 h-8 rounded-md border border-[#2b3035]" onClick={onClose}>Close</button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-950 text-[12px] font-mono">
          {change.diff.map((line, idx) => (
            <div
              key={`${line.kind}-${idx}`}
              className={`grid grid-cols-[64px_64px_1fr] gap-3 px-3 py-0.5 ${
                line.kind === 'added'
                  ? 'bg-emerald-900/30 text-emerald-100'
                  : line.kind === 'removed'
                    ? 'bg-red-900/30 text-red-100'
                    : 'text-slate-300'
              }`}
            >
              <span className="opacity-60 text-right">{line.oldLineNumber ?? ''}</span>
              <span className="opacity-60 text-right">{line.newLineNumber ?? ''}</span>
              <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
            </div>
          ))}
        </div>

        <div className="h-14 border-t border-[#2b3035] px-4 flex items-center justify-end gap-2 bg-[#111316]">
          <button className="h-9 px-3 rounded-md border border-[#2b3035]" onClick={onClose}>Cancel</button>
          <button className="h-9 px-3 rounded-md bg-blue-600 text-white" onClick={() => onApply(change)}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
