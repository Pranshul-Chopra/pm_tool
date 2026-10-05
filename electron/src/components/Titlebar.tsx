import React from 'react';
import type { NavTab } from '../types';

interface TitlebarProps {
  activeTab: NavTab;
  projectName?: string;
}

const tabTitles: Record<NavTab, string> = {
  home: 'Product Workspace',
  board: 'Sprint Kanban Board',
  dashboard: 'Data Studio & KPIs',
  documents: 'Knowledge Base',
  chat: 'AI Copilot',
  settings: 'Settings & Model Config',
};

export const Titlebar: React.FC<TitlebarProps> = ({ activeTab, projectName = 'General' }) => {
  return (
    <header className="app-drag-region h-10 w-full bg-[#111110] border-b border-[#2e2c2a] flex items-center justify-between px-3 select-none flex-shrink-0 z-50">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
          <span className="text-xs font-mono font-bold text-[#e8a84c]">PmT</span>
          <span className="text-[11px] text-[#9b9690] font-mono">v1.5.0</span>
        </div>

        <div className="h-3.5 w-[1px] bg-[#2e2c2a] mx-1" />

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#9b9690]">{projectName}</span>
          <span className="text-[#5c5955]">/</span>
          <span className="text-[#edeae4] font-medium">{tabTitles[activeTab]}</span>
        </div>
      </div>

      <div className="app-no-drag flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#9b9690] px-2 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5aab7f]" />
          <span>Local Core</span>
        </div>
      </div>
    </header>
  );
};

export default Titlebar;
