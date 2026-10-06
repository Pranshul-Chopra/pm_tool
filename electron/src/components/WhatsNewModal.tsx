import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  Database,
  ShieldCheck,
  Zap,
  Bot,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  WHATS_NEW_RELEASES,
  LATEST_RELEASE,
  type WhatsNewRelease,
  type ReleaseHighlight,
} from '../data/whatsNewData';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVersion?: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  activeVersion,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(
    activeVersion || LATEST_RELEASE.version
  );
  const [activeTab, setActiveTab] = useState<'highlights' | 'all'>('highlights');

  // Sync selected version if activeVersion prop updates
  useEffect(() => {
    if (activeVersion) {
      setSelectedVersion(activeVersion);
    }
  }, [activeVersion]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRelease: WhatsNewRelease =
    WHATS_NEW_RELEASES.find((r) => r.version === selectedVersion) || LATEST_RELEASE;

  const renderIcon = (type: ReleaseHighlight['icon']) => {
    const iconClass = 'w-4 h-4';
    switch (type) {
      case 'kpi':
        return <TrendingUp className={`${iconClass} text-[#e8a84c]`} />;
      case 'database':
        return <Database className={`${iconClass} text-[#4c97e8]`} />;
      case 'shield':
        return <ShieldCheck className={`${iconClass} text-[#5aab7f]`} />;
      case 'zap':
        return <Zap className={`${iconClass} text-[#e8a84c]`} />;
      case 'bot':
        return <Bot className={`${iconClass} text-[#b87fe8]`} />;
      case 'file-text':
        return <FileText className={`${iconClass} text-[#4ce8cf]`} />;
      default:
        return <Sparkles className={`${iconClass} text-[#e8a84c]`} />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      {/* Dialog Shell */}
      <div
        className="bg-[#161514] border border-[#2e2c2a] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Shell */}
        <div className="p-5 border-b border-[#2e2c2a] bg-[#1a1918]/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#e8a84c]/10 text-[#e8a84c] border border-[#e8a84c]/20 flex-shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-[#e8a84c]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="whats-new-title" className="text-lg font-semibold text-[#edeae4]">
                  What's New in PM Tool
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#e8a84c]/15 text-[#e8a84c] border border-[#e8a84c]/30 font-medium">
                    v{currentRelease.version}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a]">
                    {currentRelease.codename}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#9b9690] mt-1 line-clamp-2 leading-relaxed">
                {currentRelease.summary}
              </p>
            </div>
          </div>

          {/* Top-Right "X" Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] border border-transparent hover:border-[#2e2c2a] transition-colors flex-shrink-0"
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Nav Controls / Version Selector */}
        <div className="px-5 py-2.5 bg-[#141312] border-b border-[#2e2c2a] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('highlights')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeTab === 'highlights'
                  ? 'bg-[#222120] text-[#edeae4] border border-[#2e2c2a]'
                  : 'text-[#9b9690] hover:text-[#edeae4]'
              }`}
            >
              Key Highlights
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-[#222120] text-[#edeae4] border border-[#2e2c2a]'
                  : 'text-[#9b9690] hover:text-[#edeae4]'
              }`}
            >
              Full Changelog
            </button>
          </div>

          {/* Version Pills if multiple versions exist */}
          {WHATS_NEW_RELEASES.length > 1 && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-[#6b6660] text-[10px] uppercase font-sans mr-1">Version:</span>
              {WHATS_NEW_RELEASES.map((rel) => (
                <button
                  key={rel.version}
                  type="button"
                  onClick={() => setSelectedVersion(rel.version)}
                  className={`px-2 py-0.5 rounded transition-all ${
                    selectedVersion === rel.version
                      ? 'bg-[#e8a84c]/20 text-[#e8a84c] border border-[#e8a84c]/40 font-semibold'
                      : 'text-[#9b9690] hover:bg-[#1a1918] hover:text-[#edeae4] border border-transparent'
                  }`}
                >
                  v{rel.version}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'highlights' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentRelease.highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a] hover:border-[#e8a84c]/40 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg bg-[#222120] border border-[#2e2c2a] group-hover:border-[#e8a84c]/30 transition-colors">
                        {renderIcon(highlight.icon)}
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a]">
                        {highlight.tag}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-[#edeae4] mb-1.5 group-hover:text-[#e8a84c] transition-colors">
                      {highlight.title}
                    </h3>
                    <p className="text-[11px] text-[#9b9690] leading-relaxed">
                      {highlight.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {currentRelease.sections.map((sec, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                        sec.type === 'feature'
                          ? 'bg-[#5aab7f]/15 text-[#5aab7f] border border-[#5aab7f]/30'
                          : sec.type === 'improvement'
                          ? 'bg-[#4c97e8]/15 text-[#4c97e8] border border-[#4c97e8]/30'
                          : 'bg-[#e85c4c]/15 text-[#e85c4c] border border-[#e85c4c]/30'
                      }`}
                    >
                      {sec.title}
                    </span>
                    <div className="h-[1px] flex-1 bg-[#2e2c2a]" />
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {sec.items.map((item, itemIdx) => (
                      <li
                        key={itemIdx}
                        className="text-xs text-[#c5c1ba] flex items-start gap-2 leading-relaxed"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-[#e8a84c] flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Shell Footer */}
        <div className="p-4 border-t border-[#2e2c2a] bg-[#1a1918]/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[#6b6660]">
            <Info className="w-3.5 h-3.5 text-[#9b9690] flex-shrink-0" />
            <span className="hidden sm:inline">
              Access this dialog anytime by clicking the version button at the bottom-left of the shell.
            </span>
            <span className="sm:hidden">Click version at bottom-left anytime.</span>
          </div>

          {/* Bottom-Right "Got it" Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#e8a84c] hover:bg-[#d4973b] text-[#111110] font-semibold text-xs tracking-wide transition-all shadow-md hover:shadow-lg hover:shadow-[#e8a84c]/20 active:scale-95 flex items-center gap-1.5 flex-shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Got it</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
