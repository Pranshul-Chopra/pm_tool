import React, { useState } from 'react';
import {
  X,
  FileText,
  Sparkles,
  Layers,
  Cpu,
  Target,
  CheckCircle2,
  Rocket,
  Shield,
  Clock,
  Kanban,
} from 'lucide-react';
import type { Project } from '../../types';

interface DocumentGeneratorModalProps {
  isOpen: boolean;
  projects: Project[];
  selectedProjectId?: number | null;
  onClose: () => void;
  onGenerate: (payload: { title: string; prompt: string; projectId?: number }) => void;
}

type DocType = 'prd' | 'tech_spec' | 'backlog' | 'strategy' | 'summary';

interface DocTemplate {
  id: DocType;
  title: string;
  badge: string;
  desc: string;
  icon: React.ReactNode;
  defaultTitle: string;
  directive: string;
}

const TEMPLATES: DocTemplate[] = [
  {
    id: 'prd',
    title: 'Product Requirement Document',
    badge: 'PRD',
    desc: 'Executive summary, target personas, functional requirements, non-functionals, and launch rollout.',
    icon: <FileText className="w-4 h-4 text-[#e8a84c]" />,
    defaultTitle: 'PRD: Enterprise Feature Specification',
    directive:
      'Draft a comprehensive, executive-ready Product Requirement Document (PRD) with:\n' +
      '1. Executive Summary & Problem Statement\n' +
      '2. Target Personas & Primary Use Cases\n' +
      '3. Functional Requirements & Core User Flows\n' +
      '4. Technical Architecture, Dependencies & Data Models\n' +
      '5. North Star Metrics, Success Criteria & Telemetry\n' +
      '6. Phased Rollout Plan & Security Guardrails',
  },
  {
    id: 'tech_spec',
    title: 'Technical Architecture Spec',
    badge: 'Tech Spec',
    desc: 'System architecture, API contracts, database schema, latency budgets, and security audits.',
    icon: <Cpu className="w-4 h-4 text-[#4c97e8]" />,
    defaultTitle: 'Architecture Spec: High-Scale Service Design',
    directive:
      'Author a deep, production-grade Technical Architecture Specification including:\n' +
      '1. System Context & High-Level Architecture\n' +
      '2. API Endpoints, Request/Response Schemas & Contracts\n' +
      '3. Relational Database Tables & Indexing Strategy\n' +
      '4. Performance Budgets, Latency & Concurrency Targets\n' +
      '5. Failure Modes, Rate Limiting & Zero-Trust Security Protocols',
  },
  {
    id: 'backlog',
    title: 'Agile Sprint Story Breakdown',
    badge: 'Backlog',
    desc: 'Epics, prioritized user stories, Fibonacci points, and Given/When/Then acceptance criteria.',
    icon: <Kanban className="w-4 h-4 text-[#5aab7f]" />,
    defaultTitle: 'Sprint Backlog: User Story Breakdown',
    directive:
      'Decompose the initiative into discrete, actionable Agile user stories structured into:\n' +
      '1. Epic Overview & Milestone Roadmap\n' +
      '2. User Stories with Role, Goal, and Benefit\n' +
      '3. Strict Given/When/Then Acceptance Criteria\n' +
      '4. Fibonacci Story Points (1, 2, 3, 5, 8, 13)\n' +
      '5. Implementation Dependencies & Risk Flags',
  },
  {
    id: 'strategy',
    title: 'Product Strategy & KPI Plan',
    badge: 'Strategy',
    desc: 'North Star KPI, L1/L2 metric trees, guardrails, and experimentation telemetry specs.',
    icon: <Target className="w-4 h-4 text-[#d4973b]" />,
    defaultTitle: 'Telemetry Plan: North Star & Funnel Metrics',
    directive:
      'Formulate a comprehensive Product Strategy & Telemetry Tracking Framework covering:\n' +
      '1. Initiative Objectives & Strategic Alignment (OKRs)\n' +
      '2. Primary North Star Metric & Mathematical Definition\n' +
      '3. L1/L2 Input Metrics & Conversion Funnel Steps\n' +
      '4. Guardrail / Counter Metrics (latency, error rates, churn)\n' +
      '5. Event Telemetry Schema & Reporting Cadence',
  },
  {
    id: 'summary',
    title: 'Executive Brief & Evidence Synthesis',
    badge: 'Summary',
    desc: 'Evidence-grounded synthesis of indexed documents, trade-offs, and strategic decisions.',
    icon: <Sparkles className="w-4 h-4 text-[#a371f7]" />,
    defaultTitle: 'Executive Brief: Document Synthesis & Recommendations',
    directive:
      'Synthesize an executive-ready document summary grounded in company knowledge with:\n' +
      '1. Executive Summary & Critical Findings\n' +
      '2. Grounded Evidence & Document Quotes\n' +
      '3. Architectural & Trade-Off Comparison\n' +
      '4. Actionable Next Steps & Decision Register',
  },
];

export const DocumentGeneratorModal: React.FC<DocumentGeneratorModalProps> = ({
  isOpen,
  projects,
  selectedProjectId,
  onClose,
  onGenerate,
}) => {
  const [selectedType, setSelectedType] = useState<DocType>('prd');
  const [title, setTitle] = useState(TEMPLATES[0].defaultTitle);
  const [projectId, setProjectId] = useState<number | undefined>(
    selectedProjectId || (projects.length > 0 ? projects[0].id : undefined)
  );
  const [focus, setFocus] = useState('comprehensive');
  const [requirements, setRequirements] = useState('');
  const [techStack, setTechStack] = useState('');

  if (!isOpen) return null;

  const currentTemplate = TEMPLATES.find((t) => t.id === selectedType) || TEMPLATES[0];

  const handleSelectType = (tpl: DocTemplate) => {
    setSelectedType(tpl.id);
    if (!title || TEMPLATES.some((t) => t.defaultTitle === title)) {
      setTitle(tpl.defaultTitle);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const docTitle = title.trim() || currentTemplate.defaultTitle;

    let fullPrompt = `/${selectedType === 'summary' ? 'summarize' : selectedType === 'backlog' ? 'breakdown' : 'prd'} `;
    fullPrompt += `Generate a formal, publication-ready document titled "${docTitle}".\n\n`;
    fullPrompt += `### DOCUMENT SPECIFICATION\n${currentTemplate.directive}\n\n`;

    if (requirements.trim()) {
      fullPrompt += `### USER CONTEXT & REQUIREMENTS\n${requirements.trim()}\n\n`;
    }

    if (techStack.trim()) {
      fullPrompt += `### ARCHITECTURE & TECH CONSTRAINTS\n${techStack.trim()}\n\n`;
    }

    fullPrompt += `### ANALYTICAL FOCUS\nMode: ${focus}. Provide clear Markdown headers, tables, bullet points, and actionable next steps.`;

    onGenerate({
      title: docTitle,
      prompt: fullPrompt,
      projectId,
    });

    onClose();
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
            <Sparkles className="w-4 h-4 text-[#e8a84c]" />
            <h3 className="text-sm font-bold text-[#edeae4]">AI Document Synthesis & Generator</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Selector Bar */}
        <div className="px-6 py-3 bg-[#161514] border-b border-[#2e2c2a] overflow-x-auto">
          <label className="block text-[11px] font-mono text-[#9b9690] uppercase tracking-wider mb-2">
            Select Document Specification
          </label>
          <div className="flex gap-2">
            {TEMPLATES.map((tpl) => {
              const active = selectedType === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectType(tpl)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? 'bg-[#e8a84c]/15 border-[#e8a84c] text-[#e8a84c] shadow-sm'
                      : 'bg-[#222120] border-[#2e2c2a] text-[#edeae4] hover:border-[#3a3835]'
                  }`}
                >
                  {tpl.icon}
                  <span>{tpl.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Active Template Description */}
          <div className="p-3 rounded-lg bg-[#222120] border border-[#2e2c2a] text-xs text-[#9b9690] flex items-start gap-2.5">
            <div className="mt-0.5">{currentTemplate.icon}</div>
            <div>
              <div className="font-semibold text-[#edeae4]">{currentTemplate.title}</div>
              <p className="mt-0.5 text-[11px] leading-relaxed">{currentTemplate.desc}</p>
            </div>
          </div>

          {/* Document Title */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Document Title <span className="text-[#e85c4c]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PRD: Real-time Multi-tenant Invoicing Engine"
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-sm text-[#edeae4] focus:outline-none font-medium"
            />
          </div>

          {/* Project & Focus Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">
                Grounding Project Initiative
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="">Global Workspace (All indexed docs)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.domain || 'Platform'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">
                Analytical Focus
              </label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="comprehensive">Comprehensive Executive & Technical Brief</option>
                <option value="technical">Deep Technical Architecture & Contracts</option>
                <option value="roadmap">Sprint Roadmap, Milestones & Backlog Stories</option>
                <option value="risks">Risk Mitigation, Zero-Trust & Failure Modes</option>
              </select>
            </div>
          </div>

          {/* User Context & Requirements */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Initiative Scope & Key Requirements
            </label>
            <textarea
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="What core user friction are we solving? What are the key user journeys, acceptance criteria, or target milestones?"
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Architecture / Constraints */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Architecture Constraints & Tech Stack
            </label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g. FastAPI, PostgreSQL, Redis, OAuth2, 99.99% uptime, sub-100ms p95"
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none font-mono"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Document</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentGeneratorModal;
