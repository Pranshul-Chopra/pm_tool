import React from 'react';
import {
  Kanban,
  Bot,
  Trash2,
  Calendar,
  User,
  Target,
  FileText,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onOpenDetail: (project: Project) => void;
  onOpenInBoard: (projectId: number) => void;
  onDiscussInCopilot: (projectId: number) => void;
  onDelete: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpenDetail,
  onOpenInBoard,
  onDiscussInCopilot,
  onDelete,
}) => {
  const healthLabels: Record<string, { label: string; color: string; bg: string }> = {
    on_track: { label: 'On Track', color: '#5aab7f', bg: 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]' },
    planning: { label: 'Planning', color: '#4c97e8', bg: 'bg-[#4c97e8]/10 border-[#4c97e8]/30 text-[#4c97e8]' },
    at_risk: { label: 'At Risk', color: '#e8a84c', bg: 'bg-[#e8a84c]/10 border-[#e8a84c]/30 text-[#e8a84c]' },
    blocked: { label: 'Blocked', color: '#e85c4c', bg: 'bg-[#e85c4c]/10 border-[#e85c4c]/30 text-[#e85c4c]' },
    completed: { label: 'Completed', color: '#a371f7', bg: 'bg-[#a371f7]/10 border-[#a371f7]/30 text-[#a371f7]' },
  };

  const hInfo = healthLabels[project.health || 'planning'] || healthLabels.planning;
  const progressPct = project.progress_pct ?? 0;
  const taskCount = project.task_count ?? 0;
  const doneCount = project.done_task_count ?? 0;

  return (
    <div className="bg-[#1a1918] hover:bg-[#1f1e1c] border border-[#2e2c2a] hover:border-[#3a3835] rounded-xl p-5 flex flex-col justify-between transition-all duration-150 group">
      <div>
        {/* Top Header: Title & Health Pill */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <h3
            onClick={() => onOpenDetail(project)}
            className="text-base font-bold text-[#edeae4] hover:text-[#e8a84c] cursor-pointer transition-colors leading-snug line-clamp-1"
            title={project.name}
          >
            {project.name}
          </h3>

          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1.5 flex-shrink-0 ${hInfo.bg}`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hInfo.color }} />
            <span>{hInfo.label}</span>
          </span>
        </div>

        {/* Badges Row: Domain, Priority, Target Date */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#edeae4]">
            {project.domain || 'Platform'}
          </span>

          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
              project.priority === 'urgent' || project.priority === 'critical'
                ? 'bg-[#e85c4c]/10 text-[#e85c4c] border-[#e85c4c]/30'
                : project.priority === 'high'
                ? 'bg-[#e8a84c]/10 text-[#e8a84c] border-[#e8a84c]/30'
                : 'bg-[#222120] text-[#9b9690] border-[#2e2c2a]'
            }`}
          >
            {project.priority || 'medium'}
          </span>

          {project.target_date && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#9b9690] flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5 text-[#5c5955]" />
              <span>{project.target_date}</span>
            </span>
          )}
        </div>

        {/* Description Excerpt */}
        {project.description && (
          <p className="text-xs text-[#9b9690] line-clamp-2 leading-relaxed mb-3">
            {project.description}
          </p>
        )}

        {/* Goals Callout (if available) */}
        {project.goals && (
          <div className="p-2.5 rounded-lg bg-[#222120]/80 border border-[#2e2c2a] text-xs text-[#e8a84c] line-clamp-1 mb-3">
            <span className="font-semibold text-[10px] uppercase font-mono tracking-wider mr-1.5 text-[#9b9690]">
              Goal:
            </span>
            {project.goals}
          </div>
        )}
      </div>

      <div>
        {/* Progress Bar & Task Completion Metric */}
        <div className="pt-3 border-t border-[#2e2c2a]/80 mb-3.5">
          <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
            <span className="text-[#9b9690]">
              {doneCount}/{taskCount} tasks done
            </span>
            <span className="font-semibold text-[#edeae4]">{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#222120] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct === 100
                  ? 'bg-[#5aab7f]'
                  : progressPct > 50
                  ? 'bg-[#e8a84c]'
                  : 'bg-[#4c97e8]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Meta Row: Owner & Updated Date */}
        <div className="flex items-center justify-between text-[11px] text-[#78746f] mb-3 font-mono">
          <span className="truncate max-w-[150px]">
            Lead: {project.owner || 'Unassigned'}
          </span>
          <span>{project.updated_at ? project.updated_at.slice(0, 10) : ''}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#2e2c2a]/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onOpenDetail(project)}
              className="px-2.5 py-1 rounded bg-[#222120] hover:bg-[#282725] text-xs text-[#edeae4] border border-[#2e2c2a] transition-colors"
            >
              Backlog ({taskCount})
            </button>
            <button
              onClick={() => onOpenInBoard(project.id)}
              className="px-2.5 py-1 rounded bg-[#e8a84c]/10 hover:bg-[#e8a84c]/20 text-xs text-[#e8a84c] border border-[#e8a84c]/30 font-medium transition-colors flex items-center gap-1"
            >
              <Kanban className="w-3 h-3" />
              <span>Board</span>
            </button>
            <button
              onClick={() => onDiscussInCopilot(project.id)}
              className="px-2 py-1 rounded bg-[#222120] hover:bg-[#282725] text-xs text-[#9b9690] hover:text-[#edeae4] border border-[#2e2c2a] transition-colors"
              title="Discuss in Copilot"
            >
              <Bot className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => onDelete(project)}
            className="p-1.5 rounded text-[#9b9690] hover:text-[#e85c4c] hover:bg-[#222120] transition-colors"
            title="Delete Project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
