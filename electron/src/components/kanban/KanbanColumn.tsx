import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onQuickAdd: (status: TaskStatus) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  color,
  tasks,
  onOpenDetail,
  onDelete,
  onQuickAdd,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'Column',
      columnId: id,
    },
  });

  const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-[#161514] border rounded-xl overflow-hidden min-h-0 transition-colors ${
        isOver ? 'border-[#e8a84c] shadow-[0_0_12px_rgba(232,168,76,0.15)]' : 'border-[#2e2c2a]'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918]/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-xs font-semibold text-[#edeae4]">{title}</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a]">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {totalPoints > 0 && (
            <span className="text-[10px] font-mono text-[#9b9690]" title="Total story points in lane">
              {totalPoints} pts
            </span>
          )}
          <button
            onClick={() => onQuickAdd(id)}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
            title={`Add ticket to ${title}`}
            aria-label={`Add ticket to ${title}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Droppable Cards Container */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[120px]">
        <SortableContext items={tasks.map((t) => t.id.toString())} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpenDetail={onOpenDetail}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-28 border border-dashed border-[#2e2c2a] rounded-lg flex items-center justify-center text-[11px] text-[#5c5955]">
            Drop tickets here
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
