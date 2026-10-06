import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  FileText,
  GripVertical,
  Layers,
  ArrowRight,
  X,
  FileDown,
  Download,
  FolderPlus,
  Kanban,
  Loader2,
  CheckCircle2,
  Folder,
  RefreshCw,
} from 'lucide-react';
import AppBridge from '../services/bridge';
import MarkdownContent from '../components/chat/MarkdownContent';
import { DocumentGeneratorModal } from '../components/chat/DocumentGeneratorModal';
import { DecomposerModal } from '../components/kanban/DecomposerModal';
import type { Project } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: { filename?: string; section?: string }[];
  suggestions?: string[];
}

interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
}

const COMMAND_CHIPS = [
  { cmd: '/query', label: 'Database Query', desc: 'Synthesize guarded SQL queries for connected datasets' },
  { cmd: '/plan', label: 'Sprint & Roadmap', desc: 'Structure multi-phase roadmap and ticket proposals' },
  { cmd: '/prd', label: 'Draft PRD', desc: 'Synthesize comprehensive requirements' },
  { cmd: '/breakdown', label: 'Decompose Stories', desc: 'Break initiatives into Agile stories' },
  { cmd: '/data', label: 'KPI Insights', desc: 'Inspect dataset metrics and health' },
  { cmd: '/search', label: 'Knowledge Base', desc: 'Grounded query on indexed docs' },
  { cmd: '/metrics', label: 'Telemetry', desc: 'Define North Star and funnel metrics' },
  { cmd: '/summarize', label: 'Executive Summary', desc: '8K budget document synthesis' },
];

const DEFAULT_SUGGESTIONS = [
  'Draft a PRD for OAuth2 authentication with JWT refresh tokens',
  'Structure a 3-phase roadmap and create sprint backlog tickets',
  'Break down our sprint backlog and identify blocking technical risks',
  'Define 3 North Star KPIs and guardrail metrics for our new feature',
  'Summarize the key architectural decisions from our indexed docs',
];

export interface ChatViewProps {
  inheritedTab?: string | null;
  initialProjectId?: number | null;
  onClearInheritedTab?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  inheritedTab,
  initialProjectId,
  onClearInheritedTab,
}) => {
  // Conversations State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isResizing = useRef(false);

  // Projects & LLM Gateway State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    initialProjectId || null
  );
  const [llmStatus, setLlmStatus] = useState<{ provider?: string; model?: string } | null>(null);

  // Modal States
  const [isDocGenOpen, setIsDocGenOpen] = useState(false);
  const [isDecomposerOpen, setIsDecomposerOpen] = useState(false);
  const [decomposerPrdText, setDecomposerPrdText] = useState('');

  // Export & Action Feedback States
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  // Applied Actions State (Persisted across tab switches)
  const [appliedActionKeys, setAppliedActionKeys] = useState<Set<string>>(new Set());

  // Chat Stream State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tab Inherit & Slash Suggestions State
  const [dismissedInheritedTab, setDismissedInheritedTab] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const matchingCommands =
    input.startsWith('/') && !activeCommand
      ? COMMAND_CHIPS.filter(
          (c) =>
            c.cmd.toLowerCase().startsWith(input.trim().toLowerCase()) ||
            c.label.toLowerCase().includes(input.slice(1).trim().toLowerCase())
        )
      : [];
  const showSlashMenu = matchingCommands.length > 0;

  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [input]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load projects, LLM status, and conversations on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [projRes, llmRes] = await Promise.all([
          AppBridge.api.getProjects().catch(() => ({ projects: [] })),
          AppBridge.api.getLLMStatus().catch(() => null),
        ]);
        setProjects(projRes.projects || []);
        if (llmRes) {
          setLlmStatus({ provider: llmRes.provider, model: llmRes.model });
        }
      } catch (err) {
        console.error('Failed to load initial workspace context:', err);
      }
    }
    loadInitialData();
    loadConversations();
  }, []);

  const loadConversations = async (projId?: number | null) => {
    try {
      const res = await AppBridge.api.getConversations(projId || undefined);
      const convList = res.conversations || [];
      setConversations(convList);
      if (convList.length > 0) {
        selectConversation(convList[0].id);
      } else {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      startNewChat();
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const res = await AppBridge.api.getConversation(convId);
      const rawMsgs = res.messages || [];
      const mapped: ChatMessage[] = rawMsgs.map((m: any) => ({
        id: m.id?.toString() || Math.random().toString(),
        sender: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        timestamp: m.created_at
          ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
      }));
      setMessages(mapped);

      // Restore persisted applied action keys
      if (res.applied_action_keys && Array.isArray(res.applied_action_keys)) {
        setAppliedActionKeys(new Set(res.applied_action_keys));
      } else {
        setAppliedActionKeys(new Set());
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setAppliedActionKeys(new Set());
    setMessages([
      {
        id: 'init',
        sender: 'assistant',
        content:
          '👋 **PM Copilot is active and grounded in your local workspace.**\n\nI can author executive PRDs, decompose initiatives into sprint user stories, analyze connected datasets, or synthesize project documents. Choose a command chip below, click **Generate Document**, or ask anything to get started.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: DEFAULT_SUGGESTIONS,
      },
    ]);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await AppBridge.api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // ── Sidebar Resize Logic ───────────────────────────────────────────────────

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMoveResize);
    document.addEventListener('mouseup', handleMouseUpResize);
  };

  const handleMouseMoveResize = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(120, Math.min(360, e.clientX - 64)); // Clamp between 120px and 360px
    setSidebarWidth(newWidth);
  };

  const handleMouseUpResize = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMoveResize);
    document.removeEventListener('mouseup', handleMouseUpResize);
  };

  // ── Title & Filename Helper ────────────────────────────────────────────────

  const extractDocTitle = (content: string, fallback: string = 'Document'): string => {
    const headingMatch = content.match(new RegExp('^#+\\s+(.+)$', 'm'));
    if (headingMatch && headingMatch[1]) {
      const cleanHeading = headingMatch[1].replace(new RegExp('[*_`#]', 'g'), '').trim();
      if (cleanHeading) return cleanHeading;
    }
    return fallback;
  };

  const cleanFilenameString = (name: string): string => {
    const sanitized = name.replace(new RegExp('[^a-zA-Z0-9_\\-\\s]', 'g'), '').trim();
    return sanitized || 'Document';
  };

  // ── Document Export & Actions ──────────────────────────────────────────────

  const handleCopyMarkdown = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msg.id ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleExportDocx = async (msg: ChatMessage) => {
    const exportKey = `${msg.id}-docx`;
    setExportingDocId(exportKey);
    try {
      const title = extractDocTitle(msg.content, `PRD_${new Date().toISOString().slice(0, 10)}`);
      const blob = await AppBridge.api.exportDocx(title, msg.content, {
        Author: 'PM Tool AI Copilot',
        Date: new Date().toISOString().slice(0, 10),
        Status: 'Generated Spec',
        Project: selectedProjectId
          ? projects.find((p) => p.id === selectedProjectId)?.name || 'Default'
          : 'General Workspace',
      });
      const filename = `${cleanFilenameString(title)}.docx`;
      AppBridge.api.downloadBlob(blob, filename);
    } catch (err: any) {
      console.error('Export DOCX failed:', err);
    } finally {
      setExportingDocId(null);
    }
  };

  const handleExportMarkdown = async (msg: ChatMessage) => {
    const exportKey = `${msg.id}-md`;
    setExportingDocId(exportKey);
    try {
      const title = extractDocTitle(msg.content, `Spec_${new Date().toISOString().slice(0, 10)}`);
      const blob = await AppBridge.api.exportMarkdown(title, msg.content);
      const filename = `${cleanFilenameString(title)}.md`;
      AppBridge.api.downloadBlob(blob, filename);
    } catch (err: any) {
      console.error('Export Markdown failed:', err);
    } finally {
      setExportingDocId(null);
    }
  };

  const handleSaveToKnowledgeBase = async (msg: ChatMessage) => {
    setSavingDocId(msg.id);
    try {
      const title = extractDocTitle(msg.content, `AI_Spec_${Date.now().toString().slice(-4)}`);
      await AppBridge.api.saveDocumentToKnowledgeBase(
        title,
        msg.content,
        selectedProjectId || undefined
      );
      setSavedDocId(msg.id);
      setTimeout(() => {
        setSavedDocId((prev) => (prev === msg.id ? null : prev));
      }, 3000);
    } catch (err: any) {
      console.error('Save to Knowledge Base failed:', err);
    } finally {
      setSavingDocId(null);
    }
  };

  const handleDecomposePrd = (msg: ChatMessage) => {
    setDecomposerPrdText(msg.content);
    setIsDecomposerOpen(true);
  };

  const handleDocGenSubmit = (payload: { title: string; prompt: string; projectId?: number }) => {
    setIsDocGenOpen(false);
    if (payload.projectId !== undefined && payload.projectId !== null) {
      setSelectedProjectId(payload.projectId);
    }
    handleSendMessage(payload.prompt);
  };

  // ── Message Dispatch ───────────────────────────────────────────────────────

  const handleSendMessage = async (customText?: string) => {
    const rawText = customText || input;
    if (!rawText.trim() && !activeCommand) return;

    let fullPrompt = activeCommand ? `${activeCommand} ${rawText}` : rawText;
    fullPrompt = fullPrompt.trim();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: fullPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setActiveCommand(null);
    setLoading(true);

    try {
      const res = await AppBridge.api.sendChatMessage({
        message: fullPrompt,
        conversation_id: activeConvId || undefined,
        project_id: selectedProjectId || undefined,
      });

      if (res.conversation_id && res.conversation_id !== activeConvId) {
        setActiveConvId(res.conversation_id);
        const convListRes = await AppBridge.api.getConversations(selectedProjectId || undefined);
        setConversations(convListRes.conversations || []);
      }

      // Generate context-aware follow-up suggestions
      const suggestions: string[] = [];
      if (fullPrompt.toLowerCase().includes('/prd') || fullPrompt.toLowerCase().includes('requirement document')) {
        suggestions.push(
          'Decompose this PRD into Agile sprint user stories',
          'Draft Given/When/Then acceptance criteria for these stories',
          'Identify technical risks and architectural trade-offs'
        );
      } else if (fullPrompt.toLowerCase().includes('/data') || fullPrompt.toLowerCase().includes('/insights')) {
        suggestions.push(
          'Create KPI cards for these metrics in Data Studio',
          'Run a guarded SQL query to inspect outliers',
          'Generate weekly telemetry tracking specifications'
        );
      } else {
        suggestions.push(
          'Draft a formal PRD for this initiative',
          'Break down the implementation into sprint backlog tickets',
          'Search knowledge base for related architecture decisions'
        );
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: res.response || 'No response returned from model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: res.sources,
        suggestions,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: `⚠️ **Error communicating with LLM Gateway:**\n\n${err.message || 'Server timeout or connection failed.'}\n\nPlease check Settings to ensure your local Ollama or API provider is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % matchingCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = matchingCommands[slashSelectedIndex];
        if (selected) {
          setActiveCommand(selected.cmd);
          setInput('');
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Backspace' && !input && activeCommand) {
      setActiveCommand(null);
    } else if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* ── Collapsible & Resizable Conversations Sidebar ──────────────────── */}
      <div
        style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}
        className="h-full bg-[#161514] border-r border-[#2e2c2a] flex flex-col justify-between transition-[width] duration-150 relative select-none flex-shrink-0"
      >
        {/* Sidebar Header */}
        <div className="p-2 border-b border-[#2e2c2a] flex items-center justify-between">
          {!sidebarCollapsed && (
            <button
              onClick={startNewChat}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#e8a84c]/10 hover:bg-[#e8a84c]/20 border border-[#e8a84c]/30 rounded-lg text-xs font-semibold text-[#e8a84c] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Thread</span>
            </button>
          )}

          {sidebarCollapsed && (
            <button
              onClick={startNewChat}
              className="w-8 h-8 mx-auto flex items-center justify-center bg-[#e8a84c]/10 text-[#e8a84c] rounded-lg"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] ml-1"
            title={sidebarCollapsed ? 'Expand thread list' : 'Collapse thread list'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Conversations List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer group transition-colors ${
                  activeConvId === c.id
                    ? 'bg-[#222120] text-[#edeae4] font-medium border border-[#3a3835]'
                    : 'text-[#9b9690] hover:bg-[#1a1918] hover:text-[#edeae4]'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-[#5c5955] group-hover:text-[#e8a84c]" />
                  <span className="truncate">{c.title || 'Untitled Thread'}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteConversation(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#5c5955] hover:text-[#e85c4c] rounded"
                  title="Delete thread"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Resize Drag Handle */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={handleMouseDownResize}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#e8a84c]/50 transition-colors"
            title="Drag to resize thread sidebar"
          />
        )}
      </div>

      {/* ── Main Chat Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 h-full flex flex-col bg-[#111110] overflow-hidden">
        {/* Workspace Toolbar / Header Bar */}
        <div className="h-12 border-b border-[#2e2c2a] bg-[#161514] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 text-[#e8a84c] flex-shrink-0" />
              <h2 className="text-xs font-semibold text-[#edeae4] truncate">
                {activeConvId
                  ? conversations.find((c) => c.id === activeConvId)?.title || 'Active Thread'
                  : 'New Session'}
              </h2>
            </div>

            {/* Active LLM Model Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111110] border border-[#2e2c2a] text-[10px] font-mono text-[#9b9690]">
              <Sparkles className="w-2.5 h-2.5 text-[#e8a84c]" />
              <span className="uppercase text-[#e8a84c] font-semibold">{llmStatus?.provider || 'LLM'}</span>
              <span className="text-[#5c5955]">·</span>
              <span className="text-[#edeae4] truncate max-w-[120px]">{llmStatus?.model || 'Ready'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Project Context Selector */}
            <div className="flex items-center gap-1.5 bg-[#111110] border border-[#2e2c2a] rounded-lg px-2.5 py-1 text-xs text-[#edeae4]">
              <Folder className="w-3.5 h-3.5 text-[#e8a84c] flex-shrink-0" />
              <select
                value={selectedProjectId || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedProjectId(val);
                  loadConversations(val);
                }}
                className="bg-transparent border-none text-xs text-[#edeae4] focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="" className="bg-[#1a1918] text-[#edeae4]">
                  All Projects
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1918] text-[#edeae4]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Document Action Button */}
            <button
              onClick={() => setIsDocGenOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
              title="Open PM Document Generator (PRD, Architecture Spec, Backlog Breakdown)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate Document</span>
              <span className="sm:hidden">Generate</span>
            </button>
          </div>
        </div>

        {/* ── Contextual Tab Inheritance Banner ─────────────────────────────── */}
        {inheritedTab && !dismissedInheritedTab && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-[#1f1e1c] via-[#1a1918] to-[#161514] border-b border-[#2e2c2a] flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5 flex-1 mr-2">
              <div className="p-1 rounded bg-[#e8a84c]/10 text-[#e8a84c] flex-shrink-0">
                {inheritedTab === 'board' ? '📌' : inheritedTab === 'dashboard' ? '📊' : '📚'}
              </div>
              <div className="text-[#edeae4]">
                <span className="font-semibold text-[#e8a84c]">
                  {inheritedTab === 'board'
                    ? 'Sprint Board Scope Active:'
                    : inheritedTab === 'dashboard'
                    ? 'Data Studio Scope Active:'
                    : 'Knowledge Base Scope Active:'}
                </span>{' '}
                <span className="text-[#9b9690]">
                  {inheritedTab === 'board'
                    ? 'Live visibility into sprint backlog, user tickets, and velocity.'
                    : inheritedTab === 'dashboard'
                    ? 'Live visibility into ingested datasets, column telemetry, and KPI cards.'
                    : 'Live visibility into indexed documents, PRDs, and architecture specs.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {inheritedTab === 'board' && (
                <>
                  <button
                    onClick={() => {
                      setActiveCommand('/plan');
                      setInput('Create a 3-phase roadmap and break down sprint stories');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#e8a84c] font-mono cursor-pointer"
                  >
                    ⚡ /plan
                  </button>
                  <button
                    onClick={() => {
                      setActiveCommand('/breakdown');
                      setInput('Decompose upcoming initiatives into tickets');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#edeae4] font-mono cursor-pointer"
                  >
                    📝 /breakdown
                  </button>
                </>
              )}
              {inheritedTab === 'dashboard' && (
                <>
                  <button
                    onClick={() => {
                      setActiveCommand('/data');
                      setInput('Analyze connected datasets and highlight outliers');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#e8a84c] font-mono cursor-pointer"
                  >
                    📊 /data
                  </button>
                  <button
                    onClick={() => {
                      setActiveCommand('/metrics');
                      setInput('Define North Star KPIs and guardrails');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#edeae4] font-mono cursor-pointer"
                  >
                    🎯 /metrics
                  </button>
                </>
              )}
              {inheritedTab === 'documents' && (
                <>
                  <button
                    onClick={() => {
                      setActiveCommand('/search');
                      setInput('Query indexed knowledge base documents');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#e8a84c] font-mono cursor-pointer"
                  >
                    🔍 /search
                  </button>
                  <button
                    onClick={() => {
                      setActiveCommand('/summarize');
                      setInput('Summarize key architectural decisions');
                    }}
                    className="px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#edeae4] font-mono cursor-pointer"
                  >
                    📑 /summarize
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setDismissedInheritedTab(true);
                  if (onClearInheritedTab) onClearInheritedTab();
                }}
                className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── /plan Studio Active Header Banner ─────────────────────────────── */}
        {activeCommand === '/plan' && (
          <div className="px-4 py-2 bg-gradient-to-r from-[#e8a84c]/15 via-[#1a1918] to-[#161514] border-b border-[#e8a84c]/30 flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-[#e8a84c]/20 text-[#e8a84c]">
                <Kanban className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-[#edeae4]">Sprint & Roadmap Studio Mode Active</span>
                <span className="text-[11px] text-[#9b9690] ml-2">Phase Header Blocks + 1-Click Action Proposals enabled</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInput('Structure a 3-phase release roadmap and break down sprint backlog tickets')}
                className="px-2.5 py-1 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#e8a84c] font-mono cursor-pointer transition-colors"
              >
                ⚡ Insert Plan Prompt
              </button>
            </div>
          </div>
        )}

        {/* Stream Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-[#e8a84c] text-black font-medium selection:bg-black selection:text-white'
                    : 'bg-[#1a1918] border border-[#2e2c2a] text-[#edeae4] w-full'
                }`}
              >
                {/* Message Body */}
                <div>
                  {m.sender === 'assistant' ? (
                    <MarkdownContent
                      content={m.content}
                      conversationId={activeConvId || undefined}
                      appliedActionKeys={appliedActionKeys}
                      onPromptClick={(prompt) => handleSendMessage(prompt)}
                      onActionApplied={(task, actionKey) => {
                        console.log('Action applied to Kanban Board:', task, actionKey);
                        if (actionKey) {
                          setAppliedActionKeys((prev) => new Set([...prev, actionKey]));
                        }
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>

                {/* Grounding Sources Badge */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#2e2c2a] flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-[#9b9690] flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#e8a84c]" />
                      <span>Evidence Grounding:</span>
                    </span>
                    {m.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] text-[#e8a84c] border border-[#2e2c2a]"
                      >
                        {s.filename}
                      </span>
                    ))}
                  </div>
                )}

                {/* User Message Timestamp */}
                {m.sender === 'user' && (
                  <div className="text-[10px] mt-2 font-mono text-black/60 text-right">
                    {m.timestamp}
                  </div>
                )}

                {/* Assistant Message Document Action Toolbar */}
                {m.sender === 'assistant' && (
                  <div className="mt-3 pt-2.5 border-t border-[#2e2c2a] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Copy Markdown */}
                      <button
                        onClick={() => handleCopyMarkdown(m)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#222120] hover:bg-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] border border-[#2e2c2a] transition-colors cursor-pointer"
                        title="Copy Markdown to clipboard"
                      >
                        {copiedMsgId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#5aab7f]" />
                            <span className="text-[#5aab7f]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#5c5955]" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Export DOCX */}
                      <button
                        onClick={() => handleExportDocx(m)}
                        disabled={exportingDocId === `${m.id}-docx`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222120] hover:bg-[#2e2c2a] text-[#edeae4] border border-[#2e2c2a] hover:border-[#4c97e8]/50 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Export styled Microsoft Word (DOCX) document"
                      >
                        {exportingDocId === `${m.id}-docx` ? (
                          <Loader2 className="w-3 h-3 text-[#4c97e8] animate-spin" />
                        ) : (
                          <FileDown className="w-3 h-3 text-[#4c97e8]" />
                        )}
                        <span>Word (DOCX)</span>
                      </button>

                      {/* Export Markdown */}
                      <button
                        onClick={() => handleExportMarkdown(m)}
                        disabled={exportingDocId === `${m.id}-md`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222120] hover:bg-[#2e2c2a] text-[#edeae4] border border-[#2e2c2a] hover:border-[#9b9690] transition-colors disabled:opacity-50 cursor-pointer"
                        title="Export clean Markdown (.md) file"
                      >
                        {exportingDocId === `${m.id}-md` ? (
                          <Loader2 className="w-3 h-3 text-[#9b9690] animate-spin" />
                        ) : (
                          <Download className="w-3 h-3 text-[#9b9690]" />
                        )}
                        <span>Markdown</span>
                      </button>

                      {/* Save directly to Knowledge Base (RAG) */}
                      <button
                        onClick={() => handleSaveToKnowledgeBase(m)}
                        disabled={savingDocId === m.id}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors disabled:opacity-50 cursor-pointer ${
                          savedDocId === m.id
                            ? 'bg-[#5aab7f]/15 text-[#5aab7f] border-[#5aab7f]/30'
                            : 'bg-[#222120] hover:bg-[#2e2c2a] text-[#edeae4] border-[#2e2c2a] hover:border-[#e8a84c]/50'
                        }`}
                        title="Ingest directly into Project Knowledge Base for grounded RAG"
                      >
                        {savedDocId === m.id ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-[#5aab7f]" />
                            <span>Saved to Docs</span>
                          </>
                        ) : savingDocId === m.id ? (
                          <>
                            <Loader2 className="w-3 h-3 text-[#e8a84c] animate-spin" />
                            <span>Indexing...</span>
                          </>
                        ) : (
                          <>
                            <FolderPlus className="w-3 h-3 text-[#e8a84c]" />
                            <span>Save to Docs</span>
                          </>
                        )}
                      </button>

                      {/* Decompose to Sprint Board */}
                      <button
                        onClick={() => handleDecomposePrd(m)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222120] hover:bg-[#e8a84c]/10 text-[#edeae4] hover:text-[#e8a84c] border border-[#2e2c2a] hover:border-[#e8a84c]/50 transition-colors cursor-pointer"
                        title="Decompose PRD into Kanban tickets & user stories"
                      >
                        <Kanban className="w-3 h-3 text-[#e8a84c]" />
                        <span>Decompose</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-[#5c5955] flex-shrink-0">
                      {m.timestamp}
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-Up Suggestion Chips */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  {m.suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSendMessage(sug)}
                      className="px-3 py-1 rounded-full bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/50 text-[11px] text-[#9b9690] hover:text-[#edeae4] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#e8a84c]" />
                      <span>{sug}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-[#5c5955]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs font-mono text-[#e8a84c] animate-pulse">
              <Bot className="w-4 h-4 animate-bounce" />
              <span>PM Copilot is synthesizing contextual response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Box & Command Bar ───────────────────────────────────────── */}
        <div className="p-4 border-t border-[#2e2c2a] bg-[#161514] flex flex-col gap-2 flex-shrink-0 relative">
          {/* Floating Slash Command Suggestions */}
          {showSlashMenu && (
            <div className="absolute bottom-full left-4 mb-2 w-84 max-w-[calc(100%-2rem)] bg-[#1a1918] border border-[#e8a84c]/40 rounded-xl shadow-2xl p-1.5 z-50 overflow-hidden backdrop-blur-md animate-fadeIn">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-[#e8a84c] border-b border-[#2e2c2a] mb-1 flex items-center justify-between">
                <span>⚡ Slash Commands</span>
                <span className="text-[#9b9690]">↑↓ Navigate · ↵ Select · Esc</span>
              </div>
              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {matchingCommands.map((c, idx) => (
                  <button
                    key={c.cmd}
                    type="button"
                    onClick={() => {
                      setActiveCommand(c.cmd);
                      setInput('');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      idx === slashSelectedIndex
                        ? 'bg-[#e8a84c] text-black font-semibold'
                        : 'hover:bg-[#222120] text-[#edeae4]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${idx === slashSelectedIndex ? 'text-black' : 'text-[#e8a84c]'}`}>
                        {c.cmd}
                      </span>
                      <span className={`text-xs ${idx === slashSelectedIndex ? 'text-black' : 'text-[#edeae4]'}`}>
                        {c.label}
                      </span>
                    </div>
                    <span className={`text-[10px] hidden sm:inline ${idx === slashSelectedIndex ? 'text-black/80' : 'text-[#9b9690]'}`}>
                      {c.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Slash Command Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COMMAND_CHIPS.map((chip) => (
              <button
                key={chip.cmd}
                onClick={() => {
                  setActiveCommand(chip.cmd);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all flex-shrink-0 cursor-pointer ${
                  activeCommand === chip.cmd
                    ? 'bg-[#e8a84c] text-black border-[#e8a84c] font-bold shadow-sm'
                    : 'bg-[#1a1918] hover:bg-[#222120] border-[#2e2c2a] text-[#9b9690] hover:text-[#e8a84c]'
                }`}
                title={chip.desc}
              >
                <span>{chip.cmd}</span>
                <span className="text-[11px] font-sans opacity-90">{chip.label}</span>
              </button>
            ))}
          </div>

          {/* Interactive Input with Command Pill */}
          <div className="flex items-center gap-2 bg-[#111110] border border-[#2e2c2a] focus-within:border-[#e8a84c] rounded-xl px-3 py-2 transition-colors">
            {activeCommand && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#e8a84c] text-black text-xs font-mono font-bold flex-shrink-0 animate-fadeIn">
                <span>{activeCommand}</span>
                <button
                  onClick={() => setActiveCommand(null)}
                  className="hover:opacity-70 p-0.5 cursor-pointer"
                  title="Remove command pill"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeCommand
                  ? `Provide parameters for ${activeCommand}...`
                  : 'Ask Copilot, draft PRDs, or click Generate Document...'
              }
              className="flex-1 bg-transparent border-none text-xs text-[#edeae4] focus:outline-none"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || (!input.trim() && !activeCommand)}
              className="p-2 rounded-lg bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-30 text-black font-semibold transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Document Generator Modal ────────────────────────────────────────── */}
      <DocumentGeneratorModal
        isOpen={isDocGenOpen}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onClose={() => setIsDocGenOpen(false)}
        onGenerate={handleDocGenSubmit}
      />

      {/* ── Agile Decomposer Modal ──────────────────────────────────────────── */}
      <DecomposerModal
        isOpen={isDecomposerOpen}
        onClose={() => setIsDecomposerOpen(false)}
        onSuccess={() => {
          // Sprint backlog tickets created
        }}
        projectId={selectedProjectId}
        projects={projects}
        initialPrdText={decomposerPrdText}
      />
    </div>
  );
};

export default ChatView;
