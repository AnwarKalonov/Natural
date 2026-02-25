import React from 'react';
import { ArrowLeft, Moon, Play, Search, Sun, User2 } from 'lucide-react';
import { CollaboratorState } from './types';

interface TopBarProps {
  projectName: string;
  collaborators: CollaboratorState[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
  onRun?: () => void;
  onPublish?: () => void;
  onSearch?: () => void;
  onProfile?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  collaborators,
  darkMode,
  onToggleDarkMode,
  onBack,
  onRun,
  onPublish,
  onSearch,
  onProfile
}) => {
  return (
    <header className="h-11 border-b border-[#2a3140] bg-[#11161f] px-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="h-7 w-7 rounded-md border border-[#2a3140] text-[#d2d9e0] hover:bg-[#1a2230] text-xs flex items-center justify-center">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="h-7 w-7 rounded-md border border-[#2a3140] bg-[#1a2230] text-[#d2d9e0] text-xs flex items-center justify-center">N</div>
        <div className="text-sm font-medium text-[#f0f4f8]">{projectName}</div>
        <button onClick={onRun} className="h-7 px-2 rounded-md text-emerald-400 text-xs hover:bg-[#1a2230] flex items-center gap-1">
          <Play className="w-3.5 h-3.5" />
          Run
        </button>
      </div>
      <div className="flex items-center gap-2">
        {collaborators.slice(0, 3).map((user) => (
          <div
            key={user.id}
            className="w-6 h-6 rounded-full border border-white text-[10px] font-semibold text-white flex items-center justify-center"
            style={{ backgroundColor: user.color }}
            title={`${user.name} • Ln ${user.cursorLine}`}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
        ))}
        <button onClick={onSearch} className="h-7 w-7 rounded-md border border-[#2a3140] text-[#c7d0d8] text-xs hover:bg-[#1a2230] flex items-center justify-center">
          <Search className="w-3.5 h-3.5" />
        </button>
        <button onClick={onProfile} className="h-7 w-7 rounded-md border border-[#2a3140] text-[#c7d0d8] text-xs hover:bg-[#1a2230] flex items-center justify-center">
          <User2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onPublish} className="h-7 px-2.5 rounded-md bg-[#2563eb] text-white text-xs font-medium">Publish</button>
        <button onClick={onToggleDarkMode} className="text-xs px-2 h-7 rounded-md border border-[#2a3140] text-[#d2d9e0] hover:bg-[#1a2230]">
          {darkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
