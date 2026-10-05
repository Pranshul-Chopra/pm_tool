import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Kanban,
  Bot,
  Trash2,
  Calendar,
  User,
  Target,
  Cpu,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { Project, Task, TaskPriority } from '../../types';
import AppBridge from '../../services/bridge';

interface ProjectDetailModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onOpenInBoard: (projectId: number) => void;
  onDiscussInCopilot: (projectId: number) => void;
  onProjectUpdated?: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  isOpen,
  project,
  onClose,
  onOpenInBoard,
  onDiscussInCopilot,
  onProjectUpdated,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('med');
  const [addingTask, setAddingTask] = useState(false);

  const fetchTasks = async (projectId: number) => {
    setLoading(true);
    try {
      const res = await AppBridge.api.getProjectTasks(projectId);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Failed to load project tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && project?.id) {
      fetchTasks(project.id);
    }
  }, [isOpen, project?.id]);

  if (!isOpen || !project) return null;

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    setAddingTask(true);
    try {
      await AppBridge.api.createTask({
        project_id: project.id,
        title: quickTitle.trim(),
        priority: quickPriority,
        status: 'todo',
      });
      setQuickTitle('');
      await fetchTasks(project.id);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      console.error('Failed to create quick task:', err);
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as any } : t))
    );
    try {
      await AppBridge.api.updateTask(taskId, { status: newStatus as any });
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      console.error('Failed to update task status:', err);
      await fetchTasks(project.id);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await AppBridge.api.deleteTask(taskId);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      console.error('Failed to delete task:', err);
      await fetchTasks(project.id);
    }
  };

  const healthLabels: Record<string, { label: string; color: string; bg: string }> = {
    on_track: { label: 'On Track', color: '#5aab7f', bg: 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]' },
    planning: { label: 'Planning', color: '#4c97e8', bg: 'bg-[#4c97e8]/10 border-[#4c97e8]/30 text-[#4c97e8]' },
    at_risk: { label: 'At Risk', color: '#e8a84c', bg: 'bg-[#e8a84c]/10 border-[#e8a84c]/30 text-[#e8a84c]' },
    blocked: { label: 'Blocked', color: '#e85c4c', bg: 'bg-[#e85c4c]/10 border-[#e85c4c]/30 text-[#e85c4c]' },
    completed: { label: 'Completed', color: '#a371f7', bg: 'bg-[#a371f7]/10 border-[#a371f7]/30 text-[#a371f7]' },
  };

  const hInfo = healthLabels[project.health || 'planning'] || healthLabels.planning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-3xl bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1e1d1b]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#edeae4] leading-snug">{project.name}</h2>
              <span className="text-[11px] font-mono text-[#9b9690]">Initiative #{project.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenInBoard(project.id);
              }}
              className="px-3 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Sprint Board</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#9b9690] hover:text-[#edeae4] hover:bg-[#282725] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Metadata Badges Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1.5 ${hInfo.bg}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hInfo.color }} />
              <span>{hInfo.label}</span>
            </span>

            <span className="text-xs px-2.5 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#edeae4] font-medium">
              {project.domain || 'Platform'}
            </span>

            <span
              className={`text-xs px-2.5 py-0.5 rounded border uppercase font-mono ${
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
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#9b9690] flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-[#5c5955]" />
                <span>{project.target_date}</span>
              </span>
            )}

            {project.owner && (
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#9b9690] flex items-center gap-1">
                <User className="w-3 h-3 text-[#5c5955]" />
                <span>Lead: {project.owner}</span>
              </span>
            )}
          </div>

          {/* Strategic Goals & OKRs */}
          {project.goals && (
            <div className="p-3.5 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e8a84c] mb-1">
                <Target className="w-3.5 h-3.5" />
                <span>Strategic Goals & OKRs</span>
              </div>
              <p className="text-xs text-[#edeae4] leading-relaxed">{project.goals}</p>
            </div>
          )}

          {/* Description & Tech Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.description && (
              <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a]">
                <div className="text-[11px] font-mono text-[#9b9690] uppercase tracking-wider mb-1">
                  Overview & Problem Statement
                </div>
                <p className="text-xs text-[#edeae4] leading-relaxed">{project.description}</p>
              </div>
            )}

            {project.tech_stack && (
              <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a]">
                <div className="text-[11px] font-mono text-[#9b9690] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-[#4c97e8]" />
                  <span>Architecture & Stack</span>
                </div>
                <p className="text-xs font-mono text-[#edeae4] leading-relaxed">{project.tech_stack}</p>
              </div>
            )}
          </div>

          {/* Task Backlog & Roadmap Execution */}
          <div className="pt-3 border-t border-[#2e2c2a]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#edeae4]">Project Tasks & Stories</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#9b9690]">
                  {tasks.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDiscussInCopilot(project.id);
                  }}
                  className="px-2.5 py-1 rounded bg-[#222120] hover:bg-[#2e2c2a] border border-[#2e2c2a] hover:border-[#e8a84c]/40 text-xs text-[#edeae4] transition-colors flex items-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5 text-[#e8a84c]" />
                  <span>Copilot</span>
                </button>
              </div>
            </div>

            {/* Quick Add Task Form */}
            <form onSubmit={handleQuickAddTask} className="flex gap-2 mb-4">
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Add a new task (e.g. Write architecture decision record)..."
                className="flex-1 bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-1.5 text-xs text-[#edeae4] focus:outline-none"
              />
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
                className="bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <button
                type="submit"
                disabled={addingTask || !quickTitle.trim()}
                className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {/* Task Item List */}
            {loading ? (
              <div className="py-6 text-center text-xs font-mono text-[#9b9690] animate-pulse">
                Loading roadmap tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center bg-[#161514] rounded-lg border border-[#2e2c2a] p-4 text-xs text-[#9b9690]">
                No user stories or roadmap tasks yet. Type a title above to add one!
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {tasks.map((task) => {
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a] hover:border-[#3a3835] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-2">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => handleToggleTask(task.id, task.status)}
                          className="w-4 h-4 rounded border-[#2e2c2a] text-[#5aab7f] focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`text-xs truncate ${
                            isDone ? 'line-through text-[#5c5955]' : 'text-[#edeae4]'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.story_points ? (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a] text-[#9b9690]">
                            {task.story_points} pts
                          </span>
                        ) : null}

                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                            task.priority === 'urgent'
                              ? 'bg-[#e85c4c]/10 text-[#e85c4c] border-[#e85c4c]/30'
                              : task.priority === 'high'
                              ? 'bg-[#e8a84c]/10 text-[#e8a84c] border-[#e8a84c]/30'
                              : 'bg-[#1a1918] text-[#9b9690] border-[#2e2c2a]'
                          }`}
                        >
                          {task.priority}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#9b9690] hover:text-[#e85c4c] hover:bg-[#1a1918] transition-all"
                          title="Delete task"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#2e2c2a] flex items-center justify-between bg-[#161514]">
          <div className="text-xs text-[#9b9690]">
            {project.updated_at ? `Updated: ${project.updated_at.slice(0, 10)}` : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs bg-[#222120] hover:bg-[#282725] text-[#edeae4] border border-[#2e2c2a] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailModal;
