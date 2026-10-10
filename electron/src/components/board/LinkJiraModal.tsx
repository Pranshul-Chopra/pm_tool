import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Shield,
  FileJson,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import AppBridge from '../../services/bridge';

interface LinkJiraModalProps {
  projectId: number;
  projectName: string;
  defaultProjectKey?: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export const LinkJiraModal: React.FC<LinkJiraModalProps> = ({
  projectId,
  projectName,
  defaultProjectKey = 'ACME',
  isOpen,
  onClose,
  onLinked,
}) => {
  const [projectKey, setProjectKey] = useState(defaultProjectKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmLink = async () => {
    if (!projectKey.trim()) {
      setError('Please provide a Jira Project Key.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.linkProjectOutpost(projectId, {
        provider: 'jira',
        project_key: projectKey.trim().toUpperCase(),
      });
      if (res.success) {
        onLinked();
        onClose();
      } else {
        setError(res.message || 'Failed to link Jira project.');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing Jira handshake.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1918] border border-[#e8a84c]/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#222120]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#e8a84c]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#edeae4]">Link Project to Atlassian Jira</h3>
              <p className="text-[11px] text-[#9b9690]">Pre-Sync Handshake & Safety Snapshot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#222120] border border-[#2e2c2a]">
            <p className="text-xs text-[#edeae4] font-medium leading-relaxed">
              You are linking local project <span className="text-[#e8a84c] font-semibold">"{projectName}"</span> to Jira project:
            </p>
            <div className="mt-2.5">
              <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                Jira Project Key
              </label>
              <input
                type="text"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="e.g. ACME"
                className="w-full text-xs font-mono uppercase bg-[#141312] border border-[#2e2c2a] rounded-lg px-3 py-2 text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
              />
            </div>
          </div>

          {/* Dictator Warning */}
          <div className="p-4 rounded-xl bg-[#d9534f]/10 border border-[#d9534f]/30 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#d9534f]">
              <Shield className="w-4 h-4" />
              <span>NOTICE: Jira becomes the authoritative dictator</span>
            </div>

            <ul className="text-[11px] text-[#edeae4]/90 space-y-1.5 pl-4 list-disc leading-relaxed">
              <li>
                <strong>Safety Snapshot Guarantee:</strong> All existing local tasks will be archived to a JSON safety snapshot in <code className="text-[#e8a84c]">%LOCALAPPDATA%\PMTool\backups</code>.
              </li>
              <li>
                <strong>Dynamic Board Workflow:</strong> Kanban columns will be replaced with Jira's active workflow stages.
              </li>
              <li>
                <strong>Authoritative State:</strong> All task creations, label updates, and column transitions will synchronize directly to Jira.
              </li>
              <li>
                You can revert to local mode or restore your local tasks snapshot at any time.
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#d9534f]/10 border border-[#d9534f]/30 text-xs text-[#d9534f]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#222120] border-t border-[#2e2c2a] flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmLink}
            disabled={loading}
            className="px-4 py-2 bg-[#d9534f] hover:bg-[#c9302c] text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#d9534f]/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Creating Snapshot & Linking...</span>
              </>
            ) : (
              <>
                <FileJson className="w-3.5 h-3.5" />
                <span>Confirm & Wipe Board (Jira Dictated)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkJiraModal;
