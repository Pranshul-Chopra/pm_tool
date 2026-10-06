import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowLeft,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';
import AppBridge from '../../services/bridge';
import type { Project } from '../../types';

interface DecomposedStory {
  title: string;
  persona: string;
  description: string;
  acceptance_criteria: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  story_points: number;
  risk_level?: string;
  tags?: string[];
  selected?: boolean;
}

interface DecomposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId?: number | null;
  projects?: Project[];
  initialPrdText?: string;
}

export const DecomposerModal: React.FC<DecomposerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projects = [],
  initialPrdText = '',
}) => {
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(
    projectId ? projectId : projects.length > 0 ? projects[0].id : undefined
  );
  const [prdText, setPrdText] = useState(initialPrdText);
  const [targetPersona, setTargetPersona] = useState<string>('All');
  const [storyCount, setStoryCount] = useState<number>(5);

  const [synthesizedStories, setSynthesizedStories] = useState<DecomposedStory[]>([]);
  const [expandedStoryIndex, setExpandedStoryIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrdText && isOpen) {
      setPrdText(initialPrdText);
    }
  }, [initialPrdText, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setError(null);
      setSynthesizedStories([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDecompose = async () => {
    if (!prdText.trim()) {
      setError('Please provide PRD text or initiative notes to decompose');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.decomposePRD({
        project_id: selectedProjectId,
        prd_text: prdText.trim(),
        target_persona: targetPersona,
        story_count: storyCount,
        preview_only: true,
      });

      if (res && res.success && Array.isArray(res.stories)) {
        const storiesWithSelection = res.stories.map((s: any) => ({
          ...s,
          selected: true,
        }));
        setSynthesizedStories(storiesWithSelection);
        setStep('preview');
      } else {
        setError(res?.error || 'Decomposition failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to call decomposition engine');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectStory = (index: number) => {
    setSynthesizedStories((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdateStoryPoints = (index: number, points: number) => {
    setSynthesizedStories((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, story_points: points } : item
      )
    );
  };

  const handleCommitStories = async () => {
    const selectedStories = synthesizedStories.filter((s) => s.selected);
    if (selectedStories.length === 0) {
      setError('Please select at least one story to commit.');
      return;
    }

    setCommitting(true);
    setError(null);
    try {
      const res = await AppBridge.api.commitStories({
        project_id: selectedProjectId,
        stories: selectedStories,
      });

      if (res && res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res?.error || 'Failed to commit stories to sprint board');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to commit stories');
    } finally {
      setCommitting(false);
    }
  };

  const selectedCount = synthesizedStories.filter((s) => s.selected).length;
  const totalPoints = synthesizedStories
    .filter((s) => s.selected)
    .reduce((sum, s) => sum + (s.story_points || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-[#161514] border border-[#2e2c2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#e8a84c]/10 text-[#e8a84c] border border-[#e8a84c]/20">
              <Sparkles className="w-4 h-4 text-[#e8a84c]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#edeae4]">
                {step === 'input' ? 'AI PRD-to-Story Decomposer' : 'Review & Approve Agile Stories'}
              </h3>
              <p className="text-[11px] text-[#9b9690]">
                {step === 'input'
                  ? 'Calibrated INVEST decomposition with testable Gherkin criteria'
                  : `Synthesized ${synthesizedStories.length} atomic stories · Select stories to add to Sprint Board`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'input' ? (
            <>
              <p className="text-xs text-[#9b9690] leading-relaxed">
                Paste product requirements or a PRD summary. The AI engine will synthesize discrete, testable Agile user stories with calibrated Fibonacci point estimates (1–13) and multi-scenario Given/When/Then acceptance criteria.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {projects.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                      Target Project
                    </label>
                    <select
                      value={selectedProjectId || ''}
                      onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.domain || 'Platform'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Stakeholder Persona
                  </label>
                  <select
                    value={targetPersona}
                    onChange={(e) => setTargetPersona(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value="All">All Stakeholders</option>
                    <option value="End-User">End-User</option>
                    <option value="Administrator">Administrator</option>
                    <option value="API Consumer">API / Integrator</option>
                    <option value="DevOps / Platform">DevOps / Platform</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Story Count
                  </label>
                  <select
                    value={storyCount}
                    onChange={(e) => setStoryCount(Number(e.target.value))}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value={3}>3 Stories (Focused)</option>
                    <option value={5}>5 Stories (Standard)</option>
                    <option value={7}>7 Stories (Comprehensive)</option>
                    <option value={10}>10 Stories (Full Epic)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                  PRD / Initiative Requirements Specification
                </label>
                <textarea
                  rows={8}
                  value={prdText}
                  onChange={(e) => setPrdText(e.target.value)}
                  placeholder="e.g. Implement user authentication with OAuth2, JWT refresh tokens, rate-limiting, password resets, and session revoking..."
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none leading-relaxed font-mono"
                />
              </div>
            </>
          ) : (
            /* Preview Step */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#9b9690] pb-2 border-b border-[#2e2c2a]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#edeae4]">
                    {selectedCount} of {synthesizedStories.length} Selected
                  </span>
                  <span className="text-[#6b6660]">·</span>
                  <span className="text-[#e8a84c] font-mono font-medium">
                    {totalPoints} Total Story Points
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = synthesizedStories.every((s) => s.selected);
                    setSynthesizedStories((prev) =>
                      prev.map((s) => ({ ...s, selected: !allSelected }))
                    );
                  }}
                  className="text-[11px] text-[#e8a84c] hover:underline"
                >
                  {synthesizedStories.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {synthesizedStories.map((story, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    story.selected
                      ? 'bg-[#1a1918] border-[#2e2c2a] hover:border-[#e8a84c]/50'
                      : 'bg-[#131211] border-[#222120] opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectStory(idx)}
                      className="mt-0.5 text-[#9b9690] hover:text-[#e8a84c] transition-colors"
                    >
                      {story.selected ? (
                        <CheckSquare className="w-4 h-4 text-[#e8a84c]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#5c5955]" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a]">
                            {story.persona}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              story.priority === 'critical'
                                ? 'bg-[#e85c4c]/15 text-[#e85c4c]'
                                : story.priority === 'high'
                                ? 'bg-[#e8a84c]/15 text-[#e8a84c]'
                                : 'bg-[#4c97e8]/15 text-[#4c97e8]'
                            }`}
                          >
                            {story.priority}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-[#6b6660]">Points:</label>
                          <select
                            value={story.story_points}
                            onChange={(e) => handleUpdateStoryPoints(idx, Number(e.target.value))}
                            className="bg-[#111110] border border-[#2e2c2a] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#e8a84c] focus:outline-none"
                          >
                            {[1, 2, 3, 5, 8, 13].map((pt) => (
                              <option key={pt} value={pt}>
                                {pt} pt{pt > 1 ? 's' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-[#edeae4] leading-snug">
                        {story.title}
                      </h4>
                      <p className="text-[11px] text-[#9b9690] mt-1 leading-relaxed">
                        {story.description}
                      </p>

                      {/* Expandable Acceptance Criteria */}
                      <div className="mt-2.5 pt-2 border-t border-[#222120]">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStoryIndex(expandedStoryIndex === idx ? null : idx)
                          }
                          className="flex items-center gap-1 text-[11px] text-[#9b9690] hover:text-[#edeae4] transition-colors"
                        >
                          {expandedStoryIndex === idx ? (
                            <ChevronDown className="w-3 h-3 text-[#e8a84c]" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-[#9b9690]" />
                          )}
                          <span>
                            {expandedStoryIndex === idx
                              ? 'Hide Acceptance Criteria'
                              : 'View Acceptance Criteria (Gherkin)'}
                          </span>
                        </button>

                        {expandedStoryIndex === idx && (
                          <div className="mt-2 p-2.5 rounded bg-[#111110] border border-[#2e2c2a] text-[11px] text-[#c5c1ba] font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {story.acceptance_criteria}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2e2c2a] bg-[#1a1918] flex items-center justify-between">
          {step === 'input' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecompose}
                disabled={loading}
                className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{loading ? 'Synthesizing INVEST Stories...' : 'Synthesize Stories'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={committing}
                className="px-3 py-1.5 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Edit PRD</span>
              </button>
              <button
                type="button"
                onClick={handleCommitStories}
                disabled={committing || selectedCount === 0}
                className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                {committing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {committing
                    ? 'Adding to Board...'
                    : `Commit ${selectedCount} Stories to Board (${totalPoints} pts)`}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecomposerModal;
