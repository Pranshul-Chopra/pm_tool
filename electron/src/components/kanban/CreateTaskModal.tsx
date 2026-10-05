import React, { useState } from 'react';
import { X, Plus, User, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../../types';

interface CreateTaskModalProps {
  isOpen: boolean;
  initialStatus: TaskStatus;
  onClose: () => void;
  onCreate: (taskData: Partial<Task>) => void;
}

const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  initialStatus,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Story title is required');
      return;
    }

    onCreate({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      story_points: storyPoints,
      acceptance_criteria: acceptanceCriteria.trim(),
      assignee: assignee.trim(),
    });

    // Reset & close
    setTitle('');
    setDescription('');
    setAcceptanceCriteria('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-xl bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#e8a84c]" />
            <h3 className="text-sm font-bold text-[#edeae4]">Create New User Story</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">
              Story Title <span className="text-[#e85c4c]">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-sm text-[#edeae4] focus:outline-none"
              placeholder="e.g. As a user, I want..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9b9690] mb-1">Lane</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="todo">Backlog</option>
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
                  placeholder="@pranshul"
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-2 text-xs text-[#edeae4] focus:outline-none font-mono"
                />
                <User className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">Story Points</label>
            <div className="flex items-center gap-2">
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

          <div>
            <label className="block text-xs font-medium text-[#9b9690] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 text-xs text-[#edeae4] focus:outline-none resize-none"
              placeholder="Context or notes..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#2e2c2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Story</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
