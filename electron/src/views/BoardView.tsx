import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import AppBridge from '../services/bridge';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'Backlog / To Do', color: '#9b9690' },
  { id: 'in_progress', title: 'In Progress', color: '#e8a84c' },
  { id: 'blocked', title: 'Blocked', color: '#e85c4c' },
  { id: 'done', title: 'Completed', color: '#5aab7f' },
];

export const BoardView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getTasks();
      setTasks(res.tasks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden">
      {/* Header Strip */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">Sprint Kanban Board</h2>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Agile user stories, Fibonacci estimates, and sprint deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-2 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
            title="Refresh board"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e8a84c]' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Columns Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col bg-[#161514] border border-[#2e2c2a] rounded-xl overflow-hidden min-h-0"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918]/60">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="text-xs font-semibold text-[#edeae4]">{col.title}</h3>
                </div>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a]">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-[#1e1d1b] border border-[#2e2c2a] hover:border-[#3a3835] text-xs shadow-sm hover:shadow transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-[#edeae4] leading-snug">{task.title}</span>
                      <span
                        className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded flex-shrink-0 border ${
                          task.priority === 'urgent'
                            ? 'bg-[#e85c4c]/10 text-[#e85c4c] border-[#e85c4c]/30'
                            : task.priority === 'high'
                            ? 'bg-[#e8a84c]/10 text-[#e8a84c] border-[#e8a84c]/30'
                            : 'bg-[#222120] text-[#9b9690] border-[#2e2c2a]'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-[#9b9690] mt-1.5 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2e2c2a]/60 text-[10px] font-mono text-[#5c5955]">
                      <span>#{task.id}</span>
                      {task.story_points ? (
                        <span className="text-[#9b9690] bg-[#161514] px-1 rounded border border-[#2e2c2a]">
                          {task.story_points} pts
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && !loading && (
                  <div className="h-28 border border-dashed border-[#2e2c2a] rounded-lg flex items-center justify-center text-[11px] text-[#5c5955]">
                    No items in this lane
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoardView;
