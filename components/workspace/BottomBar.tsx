import React from 'react';
import { Bot, Circle, ShieldAlert, ShieldX } from 'lucide-react';

interface BottomBarProps {
  language: string;
  errorCount: number;
  isConnected: boolean;
  saveState: 'saved' | 'saving' | 'unsaved';
}

export const BottomBar: React.FC<BottomBarProps> = ({ language, errorCount, isConnected, saveState }) => {
  return (
    <footer className="h-7 px-3 border-t border-[#2a3140] bg-[#11161f] flex items-center justify-between text-[11px] text-[#9aa8b7]">
      <div className="flex items-center gap-3">
        <span className="text-[#a58cff] flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> AI</span>
        <span className="text-[#c6d2df]">{language.toUpperCase()}</span>
        <span className="text-[#ff7b72] flex items-center gap-1"><ShieldX className="w-3 h-3" /> {errorCount}</span>
        <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> 0</span>
        <span className="flex items-center gap-1"><Circle className="w-3 h-3" /> 0</span>
        <span>Diff</span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          {isConnected ? 'Connected' : 'Offline'}
        </span>
      </div>
      <div>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved'} • Ln 1, Col 1 • Spaces: 2</div>
    </footer>
  );
};
