import React, { useState } from 'react';
import { Bot, Send, Sparkles, Terminal } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const COMMAND_CHIPS = [
  { cmd: '/prd', label: 'Draft PRD', desc: 'Synthesize product requirements' },
  { cmd: '/breakdown', label: 'Decompose Stories', desc: 'Break initiatives into Agile stories' },
  { cmd: '/data', label: 'Analyze KPIs', desc: 'Inspect dataset metrics and health' },
  { cmd: '/search', label: 'Search RAG', desc: 'Query organizational knowledge' },
];

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      content:
        '👋 Welcome to **AI Copilot (v2.0)**. I have direct access to your local SQLite sprint board, indexed knowledge base, and SQL analytics engine. How can I help you accelerate product delivery today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate response / placeholder for Phase 3 deep streaming
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: `⚡ Received request: "${userMsg.content}". In Phase 3, this integrates the full streaming SSE token parser with syntax highlighting.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 400);
  };

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2e2c2a] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#edeae4]">AI Copilot Studio</h2>
            <p className="text-xs text-[#9b9690]">Grounding: Sprint Tasks + RAG Documents + SQL Sandbox</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5aab7f] px-2 py-0.5 rounded bg-[#5aab7f]/10 border border-[#5aab7f]/30">
          <Sparkles className="w-3 h-3" />
          <span>Active Context Online</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-xl p-3.5 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#e8a84c] text-black font-medium'
                  : 'bg-[#1a1918] border border-[#2e2c2a] text-[#edeae4]'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div
                className={`text-[10px] mt-1.5 font-mono ${
                  m.sender === 'user' ? 'text-black/60 text-right' : 'text-[#5c5955]'
                }`}
              >
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slash Command Chips */}
      <div className="flex items-center gap-2 py-2 overflow-x-auto flex-shrink-0">
        {COMMAND_CHIPS.map((chip) => (
          <button
            key={chip.cmd}
            onClick={() => setInput((prev) => (prev ? `${prev} ${chip.cmd} ` : `${chip.cmd} `))}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/50 text-xs font-mono text-[#9b9690] hover:text-[#e8a84c] transition-colors flex-shrink-0"
          >
            <span className="text-[#e8a84c] font-bold">{chip.cmd}</span>
            <span className="text-[11px] text-[#edeae4] font-sans">{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="pt-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-2 focus-within:border-[#e8a84c] transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Copilot or type / for slash commands..."
            className="flex-1 bg-transparent border-none text-xs text-[#edeae4] px-2 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-40 text-black transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
