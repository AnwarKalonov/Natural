import React from 'react';

interface AiActionsPanelProps {
  action: string;
  scope: 'selection' | 'file' | 'project';
  instruction: string;
  isRunning: boolean;
  error: string | null;
  selectedCodeLength: number;
  onActionChange: (value: string) => void;
  onScopeChange: (value: 'selection' | 'file' | 'project') => void;
  onInstructionChange: (value: string) => void;
  onRun: () => void;
}

const ACTIONS = [
  'Refactor this function',
  'Optimize this file',
  'Add validation to this form',
  'Fix errors in this file'
];

export const AiActionsPanel: React.FC<AiActionsPanelProps> = ({
  action,
  scope,
  instruction,
  isRunning,
  error,
  selectedCodeLength,
  onActionChange,
  onScopeChange,
  onInstructionChange,
  onRun
}) => {
  return (
    <section className="rounded-xl border border-[#2b3035] bg-[#111316] p-3 shadow-sm">
      <div className="text-sm font-semibold text-[#e6edf3] mb-1">AI Actions</div>
      <div className="text-[11px] text-[#8d96a0] mb-3">Structured actions only. No silent overwrites.</div>

      <div className="space-y-2 mb-3">
        {ACTIONS.map(item => (
          <button
            key={item}
            onClick={() => onActionChange(item)}
            className={`w-full text-left px-2.5 py-2 rounded-md border text-xs ${action === item ? 'border-blue-500 bg-[#1d2a42] text-[#9dc4ff]' : 'border-[#2b3035] hover:bg-[#1b1f23]'}`}
          >
            {item}
          </button>
        ))}
      </div>

      <label className="block text-[11px] font-medium text-[#8d96a0] mb-1">Scope</label>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {(['selection', 'file', 'project'] as const).map(option => (
          <button
            key={option}
            onClick={() => onScopeChange(option)}
            className={`h-8 rounded-md text-[11px] border ${scope === option ? 'border-blue-500 bg-[#1d2a42] text-[#9dc4ff]' : 'border-[#2b3035] text-[#c9d1d9] hover:bg-[#1b1f23]'}`}
          >
            {option}
          </button>
        ))}
      </div>
      {scope === 'selection' && selectedCodeLength === 0 && (
        <div className="text-[11px] text-amber-600 mb-2">Select code in the editor first.</div>
      )}

      <label className="block text-[11px] font-medium text-[#8d96a0] mb-1">Instruction</label>
      <textarea
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        className="w-full h-24 rounded-md border border-[#2b3035] bg-[#0b0d0f] text-[#e6edf3] px-2 py-1.5 text-xs outline-none focus:border-blue-500"
        placeholder="Describe exactly what should change."
      />

      {error && <div className="mt-2 text-[11px] text-red-600">{error}</div>}

      <button
        onClick={onRun}
        disabled={isRunning}
        className="mt-3 w-full h-9 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
      >
        {isRunning ? 'Running AI…' : 'Generate Diff'}
      </button>
    </section>
  );
};
