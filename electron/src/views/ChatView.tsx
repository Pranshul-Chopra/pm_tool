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
} from 'lucide-react';
import AppBridge from '../services/bridge';
import MarkdownContent from '../components/chat/MarkdownContent';

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
  { cmd: '/prd', label: 'Draft PRD', desc: 'Synthesize comprehensive requirements' },
  { cmd: '/breakdown', label: 'Decompose Stories', desc: 'Break initiatives into Agile stories' },
  { cmd: '/data', label: 'KPI Insights', desc: 'Inspect dataset metrics and health' },
  { cmd: '/search', label: 'Knowledge Base', desc: 'Grounded query on indexed docs' },
  { cmd: '/metrics', label: 'Telemetry', desc: 'Define North Star and funnel metrics' },
  { cmd: '/summarize', label: 'Executive Summary', desc: '8K budget document synthesis' },
];

const DEFAULT_SUGGESTIONS = [
  'Draft a PRD for OAuth2 authentication with JWT refresh tokens',
  'Break down our sprint backlog and identify blocking technical risks',
  'Define 3 North Star KPIs and guardrail metrics for our new feature',
  'Summarize the key architectural decisions from our indexed docs',
];

export const ChatView: React.FC = () => {
  // Conversations State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isResizing = useRef(false);

  // Chat Stream State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversations on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await AppBridge.api.getConversations();
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
    }
    loadConversations();
  }, []);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const res = await AppBridge.api.getConversation(convId);
      const rawMsgs = res.messages || [];
      const mapped: ChatMessage[] = rawMsgs.map((m: any) => ({
        id: m.id?.toString() || Math.random().toString(),
        sender: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }));
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([
      {
        id: 'init',
        sender: 'assistant',
        content:
          '👋 **PM Copilot is active and grounded in your local data.**\n\nI can analyze your SQLite backlog, draft executive PRDs, test queries in the SQL sandbox, or synthesize indexed documentation. Choose a command chip below or ask anything to get started.',
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
      });

      if (res.conversation_id && res.conversation_id !== activeConvId) {
        setActiveConvId(res.conversation_id);
        // Refresh conversation list
        const convListRes = await AppBridge.api.getConversations();
        setConversations(convListRes.conversations || []);
      }

      // Generate context-aware follow-up suggestions
      const suggestions: string[] = [];
      if (fullPrompt.toLowerCase().includes('/prd')) {
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
                      onPromptClick={(prompt) => handleSendMessage(prompt)}
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

                <div
                  className={`text-[10px] mt-2 font-mono ${
                    m.sender === 'user' ? 'text-black/60 text-right' : 'text-[#5c5955]'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>

              {/* Follow-Up Suggestion Chips (PranshulOS Style) */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  {m.suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSendMessage(sug)}
                      className="px-3 py-1 rounded-full bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/50 text-[11px] text-[#9b9690] hover:text-[#edeae4] transition-all flex items-center gap-1.5 shadow-sm"
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
        <div className="p-4 border-t border-[#2e2c2a] bg-[#161514] flex flex-col gap-2 flex-shrink-0">
          {/* Slash Command Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COMMAND_CHIPS.map((chip) => (
              <button
                key={chip.cmd}
                onClick={() => {
                  setActiveCommand(chip.cmd);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all flex-shrink-0 ${
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
                  className="hover:opacity-70 p-0.5"
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
                  : 'Ask Copilot, draft PRDs, or click a command chip...'
              }
              className="flex-1 bg-transparent border-none text-xs text-[#edeae4] focus:outline-none"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || (!input.trim() && !activeCommand)}
              className="p-2 rounded-lg bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-30 text-black font-semibold transition-colors flex items-center justify-center flex-shrink-0"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
