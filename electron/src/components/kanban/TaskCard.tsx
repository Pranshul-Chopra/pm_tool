import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical, User, ExternalLink } from 'lucide-react';
import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  onOpenDetail: (task: Task) => void;
  onDelete: (taskId: number) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onOpenDetail, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id.toString(),
    data: {
      type: 'Task',
      task,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenDetail(task)}
      className="p-3.5 rounded-lg bg-[#1e1d1b] border border-[#2e2c2a] hover:border-[#3a3835] hover:bg-[#232220] text-xs shadow-sm hover:shadow transition-all group cursor-grab active:cursor-grabbing relative select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <div
            className="text-[#5c5955] group-hover:text-[#9b9690] p-0.5 -ml-1 mt-0.5 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
            title="Drag ticket to reorder or move across lanes"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-[#edeae4] leading-snug line-clamp-2">
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${
              task.priority === 'urgent'
                ? 'bg-[#e85c4c]/10 text-[#e85c4c] border-[#e85c4c]/30'
                : task.priority === 'high'
                ? 'bg-[#e8a84c]/10 text-[#e8a84c] border-[#e8a84c]/30'
                : task.priority === 'med'
                ? 'bg-[#4c97e8]/10 text-[#4c97e8] border-[#4c97e8]/30'
                : 'bg-[#222120] text-[#9b9690] border-[#2e2c2a]'
            }`}
          >
            {task.priority}
          </span>

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDeleteClick}
            className="opacity-0 group-hover:opacity-100 p-1 text-[#5c5955] hover:text-[#e85c4c] hover:bg-[#e85c4c]/10 rounded transition-all"
            title="Delete ticket"
            aria-label="Delete ticket"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-[11px] text-[#9b9690] mt-2 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Outpost Issue Key & Labels */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {task.external_id && (
          <a
            href={task.external_url || '#'}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0052cc]/15 text-[#4c97e8] border border-[#0052cc]/30 hover:underline"
            title={`Open ${task.external_id} in Atlassian Jira`}
          >
            <span>{task.external_id}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}

        {(() => {
          let labels: string[] = [];
          if (Array.isArray(task.external_labels)) {
            labels = task.external_labels;
          } else if (typeof task.external_labels === 'string') {
            try {
              labels = JSON.parse(task.external_labels);
            } catch (_) {}
          }
          return labels.slice(0, 3).map((lbl, idx) => (
            <span
              key={idx}
              className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#282725] text-[#9b9690] border border-[#343230]"
            >
              #{lbl}
            </span>
          ));
        })()}
      </div>

      {/* Footer Info: Task ID, Points, Assignee */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2e2c2a]/60 text-[10px] font-mono text-[#5c5955]">
        <div className="flex items-center gap-2">
          <span>#{task.id}</span>
          {task.assignee && (
            <span className="flex items-center gap-1 text-[#9b9690] bg-[#161514] px-1.5 py-0.5 rounded border border-[#2e2c2a]">
              <User className="w-2.5 h-2.5" />
              <span>{task.assignee}</span>
            </span>
          )}
        </div>

        {task.story_points ? (
          <span className="text-[#e8a84c] bg-[#e8a84c]/10 px-1.5 py-0.5 rounded border border-[#e8a84c]/20 font-bold">
            {task.story_points} pts
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default TaskCard;
