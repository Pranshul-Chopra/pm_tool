import React, { useState } from 'react';
import {
  X,
  Plus,
  Rocket,
  Bot,
  Smartphone,
  Shield,
  Zap,
  Calendar,
  User,
  Target,
  Cpu,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Project, CreateProjectPayload } from '../../types';
import AppBridge from '../../services/bridge';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

interface Preset {
  id: string;
  name: string;
  domain: string;
  priority: string;
  health: string;
  target_date: string;
  owner: string;
  goals: string;
  tech_stack: string;
  description: string;
  icon: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    id: 'saas',
    name: 'Next-Gen SaaS Billing & Subscription Hub',
    domain: 'Growth',
    priority: 'high',
    health: 'planning',
    target_date: 'Q4 2026',
    owner: 'Pranshul Chopra',
    goals: 'Improve trial-to-paid conversion by 25% and automate recurring enterprise invoicing.',
    tech_stack: 'Stripe Billing API, React, FastAPI, PostgreSQL, Webhooks',
    description: 'Self-serve billing portal with multi-seat usage metering, plan upgrades, tax calculation, and automated dunning.',
    icon: <Rocket className="w-3.5 h-3.5 text-[#e8a84c]" />,
  },
  {
    id: 'ai',
    name: 'Enterprise Knowledge AI Copilot',
    domain: 'AI/ML',
    priority: 'critical',
    health: 'on_track',
    target_date: 'Q3 2026',
    owner: 'Pranshul Chopra',
    goals: 'Accelerate engineering decision velocity and reduce internal support resolution time by 40%.',
    tech_stack: 'Python Flask, Gemini API, SQLite FTS5 RAG, Electron, Local Vector Index',
    description: 'Context-aware local-first Copilot synthesizing technical specifications, PRDs, and architecture decisions with verified evidence.',
    icon: <Bot className="w-3.5 h-3.5 text-[#5aab7f]" />,
  },
  {
    id: 'mobile',
    name: 'Mobile Customer Onboarding Experience',
    domain: 'Mobile',
    priority: 'high',
    health: 'planning',
    target_date: 'Q4 2026',
    owner: 'Pranshul Chopra',
    goals: 'Achieve 85% first-session completion rate and cut onboarding drop-off by 30%.',
    tech_stack: 'Swift, Kotlin Multiplatform, Firebase Auth, Mixpanel',
    description: 'Streamlined mobile activation flow with biometrics, social login, interactive setup checklists, and push notifications.',
    icon: <Smartphone className="w-3.5 h-3.5 text-[#4c97e8]" />,
  },
  {
    id: 'security',
    name: 'Zero-Trust IAM & Audit Governance',
    domain: 'Security',
    priority: 'critical',
    health: 'on_track',
    target_date: 'Q4 2026',
    owner: 'Pranshul Chopra',
    goals: 'Pass SOC2 Type II certification and eliminate unauthorized cross-tenant privilege escalations.',
    tech_stack: 'OAuth2, OpenID Connect, SAML 2.0, HashiCorp Vault, Audit Logging',
    description: 'Centralized identity federation, granular role-based permissions, and cryptographically verified audit trails.',
    icon: <Shield className="w-3.5 h-3.5 text-[#e85c4c]" />,
  },
  {
    id: 'infra',
    name: 'High-Throughput Event Streaming Pipeline',
    domain: 'Infrastructure',
    priority: 'high',
    health: 'planning',
    target_date: 'Q1 2027',
    owner: 'Pranshul Chopra',
    goals: 'Handle 50k events/sec with sub-50ms ingestion latency and zero message loss.',
    tech_stack: 'Apache Kafka, ClickHouse, Docker, Go / Rust, Prometheus',
    description: 'Scalable asynchronous telemetry event bus decoupled from transactional OLTP database.',
    icon: <Zap className="w-3.5 h-3.5 text-[#d4973b]" />,
  },
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('Platform');
  const [priority, setPriority] = useState('medium');
  const [health, setHealth] = useState('planning');
  const [targetDate, setTargetDate] = useState('Q4 2026');
  const [owner, setOwner] = useState('Pranshul Chopra');
  const [goals, setGoals] = useState('');
  const [techStack, setTechStack] = useState('');
  const [description, setDescription] = useState('');
  const [seedTasks, setSeedTasks] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const applyPreset = (preset: Preset) => {
    setName(preset.name);
    setDomain(preset.domain);
    setPriority(preset.priority);
    setHealth(preset.health);
    setTargetDate(preset.target_date);
    setOwner(preset.owner);
    setGoals(preset.goals);
    setTechStack(preset.tech_stack);
    setDescription(preset.description);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: CreateProjectPayload = {
      name: name.trim(),
      domain: domain.trim(),
      priority,
      health,
      target_date: targetDate.trim(),
      owner: owner.trim(),
      goals: goals.trim(),
      tech_stack: techStack.trim(),
      description: description.trim(),
      seed_tasks: seedTasks,
    };

    try {
      const created = await AppBridge.api.createProject(payload);
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#e8a84c]" />
            <h3 className="text-sm font-bold text-[#edeae4]">Create New Enterprise Project</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-6 py-3 bg-[#161514] border-b border-[#2e2c2a]">
          <label className="block text-[11px] font-mono text-[#9b9690] uppercase tracking-wider mb-2">
            Quick PM Presets (Click to autofill initiative)
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-1 rounded bg-[#222120] hover:bg-[#2e2c2a] border border-[#2e2c2a] hover:border-[#e8a84c]/40 text-xs text-[#edeae4] transition-colors flex items-center gap-1.5"
              >
                {preset.icon}
                <span>{preset.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Project Initiative Name <span className="text-[#e85c4c]">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-sm text-[#edeae4] focus:outline-none"
              placeholder="e.g. Enterprise SSO & IAM Federation"
              required
            />
          </div>

          {/* Domain, Priority, Health Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Domain / Category</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="Platform">Platform</option>
                <option value="Growth">Growth</option>
                <option value="Security">Security</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Mobile">Mobile</option>
                <option value="Enterprise">Enterprise</option>
                <option value="AI/ML">AI/ML</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Health Status</label>
              <select
                value={health}
                onChange={(e) => setHealth(e.target.value)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="planning">🔵 Planning</option>
                <option value="on_track">🟢 On Track</option>
                <option value="at_risk">🟡 At Risk</option>
                <option value="blocked">🔴 Blocked</option>
              </select>
            </div>
          </div>

          {/* Owner & Target Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Lead PM / Owner</label>
              <div className="relative">
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. Pranshul Chopra"
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-2 text-xs text-[#edeae4] focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Target Launch Date / Quarter</label>
              <div className="relative">
                <input
                  type="text"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  placeholder="e.g. Q4 2026 or 2026-12-01"
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-2 text-xs text-[#edeae4] focus:outline-none font-mono"
                />
                <Calendar className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Strategic Goals & OKRs */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#e8a84c]" />
              <span>Strategic Goals & OKRs</span>
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={2}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none"
              placeholder="What metric, KPI or outcome defines success for this initiative? (e.g. 99.99% uptime, 25% conversion gain)"
            />
          </div>

          {/* Architecture / Tech Stack */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#4c97e8]" />
              <span>Architecture & Tech Stack Notes</span>
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none font-mono"
              placeholder="e.g. OAuth2, SAML 2.0, FastAPI, Postgres, Redis"
            />
          </div>

          {/* Overview & Problem Statement */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#9b9690]" />
              <span>Overview & Problem Statement</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none"
              placeholder="Executive summary of problem context, user frictions, and target persona..."
            />
          </div>

          {/* Seed Tasks Checkbox */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#222120] border border-[#2e2c2a]">
            <input
              type="checkbox"
              id="seedTasks"
              checked={seedTasks}
              onChange={(e) => setSeedTasks(e.target.checked)}
              className="mt-0.5 rounded border-[#2e2c2a] text-[#e8a84c] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="seedTasks" className="text-xs text-[#edeae4] cursor-pointer select-none">
              <span className="font-semibold text-[#e8a84c]">Seed Standard Agile Backlog</span>
              <p className="text-[11px] text-[#9b9690] mt-0.5">
                Automatically generate 7 foundational PM roadmap stories: Problem Statement & Personas, PRD Authoring, Architecture Review, Telemetry Setup, Implementation Sprints, Security Audit, and Beta QA.
              </p>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex justify-end gap-2 border-t border-[#2e2c2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Creating Project...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Initiative</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
