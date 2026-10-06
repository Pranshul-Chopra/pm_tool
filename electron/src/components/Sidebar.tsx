import React, { useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  Database,
  BookOpen,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { NavTab, UpdateData } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  updateData: UpdateData;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenWhatsNew?: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Workspace', icon: LayoutDashboard },
  { id: 'board', label: 'Sprint Board', icon: Kanban },
  { id: 'dashboard', label: 'Data Studio', icon: Database },
  { id: 'documents', label: 'Knowledge Base', icon: BookOpen },
  { id: 'chat', label: 'AI Copilot', icon: Bot, badge: 'AI' },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  updateData,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  onOpenWhatsNew,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  return (
    <aside
      className={`h-full bg-[#161514] border-r border-[#2e2c2a] flex flex-col justify-between transition-all duration-200 select-none z-40 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Top Branding & Collapse Button */}
      <div className="flex flex-col">
        <div className="h-12 px-3 flex items-center justify-between border-b border-[#2e2c2a]/60">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#e8a84c] flex items-center justify-center font-bold text-black text-xs font-mono">
                P
              </div>
              <span className="font-bold text-sm tracking-tight text-[#edeae4]">PM Tool</span>
            </div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 mx-auto rounded bg-[#e8a84c] flex items-center justify-center font-bold text-black text-xs font-mono">
              P
            </div>
          )}

          <button
            onClick={handleToggle}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#e8a84c]/10 text-[#e8a84c] font-semibold shadow-[inset_2px_0_0_0_#e8a84c]'
                    : 'text-[#9b9690] hover:text-[#edeae4] hover:bg-[#1a1918]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#e8a84c]' : 'text-[#9b9690]'}`} />

                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#e8a84c]/15 text-[#e8a84c] border border-[#e8a84c]/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Version Strip (Automatic Background Updater & What's New) */}
      <div className="p-2 border-t border-[#2e2c2a]/60">
        <button
          type="button"
          onClick={onOpenWhatsNew}
          className={`w-full flex items-center justify-between p-2 rounded bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/50 text-[11px] font-mono text-[#9b9690] hover:text-[#edeae4] transition-all cursor-pointer group text-left ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Click to view What's New in PM Tool"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                updateData.status === 'downloaded'
                  ? 'bg-[#5aab7f] animate-pulse ring-2 ring-[#5aab7f]/30'
                  : updateData.status === 'available'
                  ? 'bg-[#e8a84c] animate-pulse'
                  : updateData.status === 'downloading'
                  ? 'bg-[#4c97e8] animate-spin'
                  : 'bg-[#5aab7f]/80'
              }`}
            />
            {!isCollapsed && (
              <span className="truncate text-[#9b9690] group-hover:text-[#edeae4] transition-colors">
                v{updateData.version || '2.0.1'}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <span className="text-[10px] text-[#e8a84c] group-hover:text-[#f3c27e] font-sans font-medium px-1.5 py-0.5 rounded bg-[#e8a84c]/10 border border-[#e8a84c]/25 flex items-center gap-1 transition-colors">
              <Sparkles className="w-2.5 h-2.5 text-[#e8a84c]" />
              What's New
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
