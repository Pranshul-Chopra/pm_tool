import React, { useState, useEffect } from 'react';
import { X, Trash2, Check, User, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../../types';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
  onDelete: (taskId: number) => void;
}

const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13];

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [storyPoints, setStoryPoints] = useState<number>(0);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'med');
      setStoryPoints(task.story_points || 0);
      setAcceptanceCriteria(task.acceptance_criteria || '');
      setAssignee(task.assignee || '');
      setError(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    onSave({
      ...task,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      story_points: storyPoints,
      acceptance_criteria: acceptanceCriteria.trim(),
      assignee: assignee.trim(),
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#9b9690]">Ticket #{task.id}</span>
            <span className="text-[#5c5955]">·</span>
            <span className="text-xs font-semibold text-[#e8a84c] uppercase font-mono">
              Agile Story
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-sm text-[#edeae4] focus:outline-none"
              placeholder="e.g. As a PM, I want automatic story points..."
            />
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="todo">Backlog / To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Assignee</label>
              <div className="relative">
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. @pranshul"
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-2 text-xs text-[#edeae4] focus:outline-none font-mono"
                />
                <User className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Fibonacci Story Points */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1.5">
              Story Points (Fibonacci)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStoryPoints(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  storyPoints === 0
                    ? 'bg-[#e8a84c]/20 border-[#e8a84c] text-[#e8a84c] font-bold'
                    : 'bg-[#111110] border-[#2e2c2a] text-[#9b9690] hover:border-[#3a3835]'
                }`}
              >
                None (0)
              </button>
              {FIBONACCI_POINTS.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setStoryPoints(pts)}
                  className={`w-9 h-8 rounded-lg text-xs font-mono font-bold border transition-all ${
                    storyPoints === pts
                      ? 'bg-[#e8a84c] border-[#e8a84c] text-black shadow-sm'
                      : 'bg-[#111110] border-[#2e2c2a] text-[#edeae4] hover:border-[#e8a84c]/50'
                  }`}
                >
                  {pts}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none leading-relaxed"
              placeholder="Context, user personas, or high-level goals..."
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Acceptance Criteria (Given / When / Then)
            </label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              rows={4}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none font-mono text-[11px] leading-relaxed"
              placeholder="• Given a user drags a card, When dropped, Then status updates instantly."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg text-xs text-[#e85c4c] hover:bg-[#e85c4c]/10 border border-[#e85c4c]/30 hover:border-[#e85c4c] transition-colors flex items-center gap-1.5"
            title="Delete this ticket permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Ticket</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
