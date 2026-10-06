import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  LayoutDashboard,
  Kanban,
  Database,
  BookOpen,
  Bot,
  Settings,
  Folder,
  PlusCircle,
  FileText,
  Terminal,
  ArrowRight,
  X,
  Sparkles,
  Columns3,
} from 'lucide-react';
import type { NavTab, Project } from '../types';
import AppBridge from '../services/bridge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab, projectId?: number | null) => void;
  onToggleSidebar?: () => void;
}

interface PaletteAction {
  id: string;
  category: 'Navigation' | 'Projects' | 'Quick Actions';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onToggleSidebar,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch projects when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      AppBridge.api.getProjects()
        .then((data) => setProjects(data || []))
        .catch(() => setProjects([]));

      // Auto-focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Construct items
  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      // Navigation
      {
        id: 'nav-home',
        category: 'Navigation',
        title: 'Product Workspace',
        subtitle: 'Overview of all active initiatives and roadmaps',
        icon: LayoutDashboard,
        shortcut: 'Ctrl+1',
        run: () => {
          onNavigate('home');
          onClose();
        },
      },
      {
        id: 'nav-board',
        category: 'Navigation',
        title: 'Agile Sprint Board',
        subtitle: 'Kanban view with story points and backlog workflow',
        icon: Kanban,
        shortcut: 'Ctrl+2',
        run: () => {
          onNavigate('board');
          onClose();
        },
      },
      {
        id: 'nav-studio',
        category: 'Navigation',
        title: 'Data Studio & SQL Sandbox',
        subtitle: 'Guarded SQLite analytics and real-time KPI benchmarks',
        icon: Database,
        shortcut: 'Ctrl+3',
        run: () => {
          onNavigate('dashboard');
          onClose();
        },
      },
      {
        id: 'nav-docs',
        category: 'Navigation',
        title: 'Knowledge Base',
        subtitle: 'RAG documentation manager with BM25 search',
        icon: BookOpen,
        shortcut: 'Ctrl+4',
        run: () => {
          onNavigate('documents');
          onClose();
        },
      },
      {
        id: 'nav-chat',
        category: 'Navigation',
        title: 'AI Copilot & PRD Generator',
        subtitle: 'LLM reasoning studio, spec drafting, and document export',
        icon: Bot,
        shortcut: 'Ctrl+5',
        run: () => {
          onNavigate('chat');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Settings & Model Configuration',
        subtitle: 'Gemini & Ollama endpoints and system diagnostic probes',
        icon: Settings,
        shortcut: 'Ctrl+6',
        run: () => {
          onNavigate('settings');
          onClose();
        },
      },

      // Quick Actions
      {
        id: 'act-new-story',
        category: 'Quick Actions',
        title: 'New Agile User Story',
        subtitle: 'Jump to Kanban board to groom a new sprint backlog item',
        icon: PlusCircle,
        run: () => {
          onNavigate('board');
          onClose();
        },
      },
      {
        id: 'act-draft-prd',
        category: 'Quick Actions',
        title: 'Draft PRD with AI Copilot',
        subtitle: 'Launch Copilot to draft a product requirement document',
        icon: Sparkles,
        run: () => {
          onNavigate('chat');
          onClose();
        },
      },
      {
        id: 'act-ingest-doc',
        category: 'Quick Actions',
        title: 'Ingest Specification / Document',
        subtitle: 'Upload and parse PDF, DOCX, or Markdown into Knowledge Base',
        icon: FileText,
        run: () => {
          onNavigate('documents');
          onClose();
        },
      },
      {
        id: 'act-sql-sandbox',
        category: 'Quick Actions',
        title: 'Run Guarded SQL Query',
        subtitle: 'Open Data Studio SQL sandbox editor',
        icon: Terminal,
        run: () => {
          onNavigate('dashboard');
          onClose();
        },
      },
      {
        id: 'act-toggle-sidebar',
        category: 'Quick Actions',
        title: 'Toggle Sidebar Collapse',
        subtitle: 'Expand or collapse the primary navigation panel',
        icon: Columns3,
        shortcut: 'Ctrl+B',
        run: () => {
          if (onToggleSidebar) onToggleSidebar();
          onClose();
        },
      },
    ];

    // Projects category
    projects.forEach((proj) => {
      list.push({
        id: `proj-${proj.id}`,
        category: 'Projects',
        title: proj.name,
        subtitle: proj.domain ? `${proj.domain} · ${proj.status || 'active'}` : proj.description || 'Project Workspace',
        icon: Folder,
        run: () => {
          onNavigate('board', proj.id);
          onClose();
        },
      });
    });

    return list;
  }, [projects, onNavigate, onClose, onToggleSidebar]);

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const lower = query.toLowerCase().trim();
    return actions.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(lower)) ||
        item.category.toLowerCase().includes(lower)
    );
  }, [actions, query]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredActions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredActions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].run();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  // Ensure selected item is scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-xl bg-[#161514] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] z-10 animate-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#2e2c2a] bg-[#1a1918]">
          <Search className="w-4 h-4 text-[#e8a84c] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to project... (ESC to exit)"
            className="w-full bg-transparent text-sm text-[#edeae4] placeholder-[#6b6660] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-[#6b6660] hover:text-[#edeae4] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#222120]"
        >
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6b6660]">
              No commands or projects match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredActions.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  data-index={index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => item.run()}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#222120] text-[#edeae4]'
                      : 'text-[#9b9690] hover:bg-[#1a1918]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#e8a84c]/20 text-[#e8a84c]'
                          : 'bg-[#1e1d1c] text-[#9b9690]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-[#edeae4]' : 'text-[#c7c3bd]'}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1a1918] text-[#6b6660] border border-[#2e2c2a] flex-shrink-0">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-[#6b6660] truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {item.shortcut && (
                      <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1918] text-[#9b9690] border border-[#2e2c2a]">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected ? 'text-[#e8a84c] translate-x-0.5' : 'text-transparent'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-[#2e2c2a] bg-[#121110] flex items-center justify-between text-[11px] font-mono text-[#6b6660]">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a] text-[#9b9690]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a] text-[#9b9690]">↵</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a] text-[#9b9690]">ESC</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#9b9690]">
            <span className="text-[#e8a84c]">PM Tool</span>
            <span>v2.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
