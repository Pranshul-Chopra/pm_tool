import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import AppBridge from '../../services/bridge';

import type { Project } from '../../types';

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
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(
    projectId ? projectId : projects.length > 0 ? projects[0].id : undefined
  );
  const [prdText, setPrdText] = useState(initialPrdText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrdText && isOpen) {
      setPrdText(initialPrdText);
    }
  }, [initialPrdText, isOpen]);

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
      });
      if (res && res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res?.error || 'Decomposition failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to call decomposition engine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-xl bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#e8a84c]" />
            <h3 className="text-sm font-bold text-[#edeae4]">AI PRD-to-Story Decomposer</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#9b9690] leading-relaxed">
            Paste product requirements or a PRD summary. The AI engine will synthesize 4–8 discrete, testable Agile user stories with Fibonacci point estimates and acceptance criteria.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">
                Target Project Initiative
              </label>
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
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
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              PRD / Feature Description
            </label>
            <textarea
              rows={6}
              value={prdText}
              onChange={(e) => setPrdText(e.target.value)}
              placeholder="e.g. Implement user authentication with OAuth2, JWT refresh tokens, and rate-limiting..."
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#2e2c2a]">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDecompose}
              disabled={loading}
              className="px-4 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{loading ? 'Synthesizing Stories...' : 'Decompose Stories'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecomposerModal;
