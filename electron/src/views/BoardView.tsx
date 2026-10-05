import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Project } from '../types';
import AppBridge from '../services/bridge';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskCard from '../components/kanban/TaskCard';
import TaskModal from '../components/kanban/TaskModal';
import CreateTaskModal from '../components/kanban/CreateTaskModal';
import DecomposerModal from '../components/kanban/DecomposerModal';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'Backlog / To Do', color: '#9b9690' },
  { id: 'in_progress', title: 'In Progress', color: '#e8a84c' },
  { id: 'blocked', title: 'Blocked', color: '#e85c4c' },
  { id: 'done', title: 'Completed', color: '#5aab7f' },
];

interface BoardViewProps {
  selectedProjectId?: number | null;
  onProjectChange?: (id: number | null) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  selectedProjectId,
  onProjectChange,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(
    selectedProjectId ?? null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Drag Overlay State
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const originalStatusRef = useRef<TaskStatus | null>(null);

  // Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<TaskStatus>('todo');
  const [isDecomposerOpen, setIsDecomposerOpen] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px drag threshold prevents accidental drags on clicks
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Robust Collision Detection: Prioritize pointer container, then rect, then center
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }
    return closestCenter(args);
  };

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getTasks();
      setTasks(res.tasks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks from core');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await AppBridge.api.getProjects();
      setProjects(res.projects || []);
    } catch (err) {
      console.error('Failed to load projects on board:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId !== undefined) {
      setCurrentProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.assignee && t.assignee.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority =
        priorityFilter === 'all' || t.priority === priorityFilter;

      const matchesProject = !currentProjectId || t.project_id === currentProjectId;

      return matchesSearch && matchesPriority && matchesProject;
    });
  }, [tasks, searchQuery, priorityFilter, currentProjectId]);

  // Sprint Velocity Metrics
  const metrics = useMemo(() => {
    const totalPoints = filteredTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completedPoints = filteredTasks
      .filter((t) => t.status === 'done')
      .reduce((sum, t) => sum + (t.story_points || 0), 0);
    const inProgressPoints = filteredTasks
      .filter((t) => t.status === 'in_progress')
      .reduce((sum, t) => sum + (t.story_points || 0), 0);

    return { totalPoints, completedPoints, inProgressPoints };
  }, [filteredTasks]);

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id.toString() === active.id);
    if (task) {
      setActiveTask(task);
      originalStatusRef.current = task.status;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) return;

    const activeTaskItem = tasks.find((t) => t.id.toString() === activeId);
    if (!activeTaskItem) return;

    // Is 'over' a Column directly?
    const isOverColumn = COLUMNS.some((c) => c.id === overId);
    if (isOverColumn) {
      const newStatus = overId as TaskStatus;
      if (activeTaskItem.status !== newStatus) {
        setTasks((prev) =>
          prev.map((t) => (t.id.toString() === activeId ? { ...t, status: newStatus } : t))
        );
      }
      return;
    }

    // Is 'over' another Task card?
    const overTaskItem = tasks.find((t) => t.id.toString() === overId);
    if (overTaskItem && activeTaskItem.status !== overTaskItem.status) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id.toString() === activeId ? { ...t, status: overTaskItem.status } : t
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id.toString();
    const initialStatus = originalStatusRef.current;
    originalStatusRef.current = null;
    setActiveTask(null);

    const activeTaskItem = tasks.find((t) => t.id.toString() === activeId);
    if (!activeTaskItem) return;

    let targetStatus: TaskStatus = activeTaskItem.status;

    if (over) {
      const overId = over.id.toString();
      // If dropped on column container
      if (COLUMNS.some((c) => c.id === overId)) {
        targetStatus = overId as TaskStatus;
      } else {
        const overTask = tasks.find((t) => t.id.toString() === overId);
        if (overTask) {
          targetStatus = overTask.status;
        }
      }

      // Reorder in array if needed
      if (activeId !== overId && !COLUMNS.some((c) => c.id === overId)) {
        const oldIndex = tasks.findIndex((t) => t.id.toString() === activeId);
        const newIndex = tasks.findIndex((t) => t.id.toString() === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          setTasks((prev) => arrayMove(prev, oldIndex, newIndex));
        }
      }
    }

    // Ensure status in state matches targetStatus
    if (activeTaskItem.status !== targetStatus) {
      setTasks((prev) =>
        prev.map((t) => (t.id.toString() === activeId ? { ...t, status: targetStatus } : t))
      );
    }

    // Persist status change to Flask backend whenever targetStatus changed
    if (initialStatus && targetStatus !== initialStatus) {
      try {
        await AppBridge.api.updateTask(activeTaskItem.id, {
          status: targetStatus,
        });
      } catch (err: any) {
        console.error('Failed to sync card drop with core:', err);
        // Rollback to initial status on network error
        setTasks((prev) =>
          prev.map((t) => (t.id.toString() === activeId ? { ...t, status: initialStatus } : t))
        );
      }
    }
  };

  const handleDragCancel = () => {
    if (originalStatusRef.current && activeTask) {
      const orig = originalStatusRef.current;
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? { ...t, status: orig } : t))
      );
    }
    setActiveTask(null);
    originalStatusRef.current = null;
  };

  // ── Card Operations ────────────────────────────────────────────────────────

  const handleOpenDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleSaveDetail = async (updated: Task) => {
    // Optimistic local update
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    try {
      await AppBridge.api.updateTask(updated.id, updated);
    } catch (err: any) {
      console.error('Failed to save task update:', err);
      setError('Failed to save changes to core.');
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    // Optimistic local removal
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await AppBridge.api.deleteTask(taskId);
    } catch (err: any) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task.');
      fetchTasks();
    }
  };

  const handleQuickAdd = (status: TaskStatus) => {
    setCreateInitialStatus(status);
    setIsCreateOpen(true);
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      const created = await AppBridge.api.createTask(taskData);
      setTasks((prev) => [created, ...prev]);
    } catch (err: any) {
      console.error('Failed to create task:', err);
      setError('Failed to create story.');
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2e2c2a] flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">
              Sprint Kanban Board
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e8a84c]/10 text-[#e8a84c] border border-[#e8a84c]/30 font-semibold">
              60 FPS dnd-kit
            </span>
          </div>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Hardware-accelerated drag-and-drop, optimistic state syncing, and Agile Fibonacci story point metrics.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDecomposerOpen(true)}
            className="px-3 py-1.5 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] hover:border-[#e8a84c]/40 text-xs text-[#edeae4] font-medium rounded-lg transition-colors flex items-center gap-1.5"
            title="Decompose PRD into User Stories with AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#e8a84c]" />
            <span>AI Decompose</span>
          </button>

          <button
            onClick={() => {
              setCreateInitialStatus('todo');
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Story</span>
          </button>

          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-1.5 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
            title="Refresh board"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e8a84c]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & Sprint Velocity Bar */}
      <div className="py-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, desc, @assignee..."
              className="w-full bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#edeae4] focus:outline-none"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1">
            <select
              value={currentProjectId ?? 'all'}
              onChange={(e) => {
                const val = e.target.value === 'all' ? null : Number(e.target.value);
                setCurrentProjectId(val);
                onProjectChange?.(val);
              }}
              className="bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none max-w-[180px] truncate font-medium"
            >
              <option value="all">All Initiatives ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="med">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Sprint Point Velocity Pills */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#9b9690]">
            <Clock className="w-3.5 h-3.5" />
            <span>Sprint:</span>
            <span className="text-[#edeae4] font-bold">{metrics.totalPoints} pts</span>
          </div>

          <div className="h-3 w-[1px] bg-[#2e2c2a]" />

          <div className="flex items-center gap-1.5 text-[#5aab7f]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Done:</span>
            <span className="font-bold">{metrics.completedPoints} pts</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Kanban Drag-and-Drop Columns Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden min-h-0 pt-1">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);

            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                color={col.color}
                tasks={colTasks}
                onOpenDetail={handleOpenDetail}
                onDelete={handleDeleteTask}
                onQuickAdd={handleQuickAdd}
              />
            );
          })}
        </div>

        {/* Drag Overlay Preview */}
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 shadow-2xl pointer-events-none">
              <TaskCard
                task={activeTask}
                onOpenDetail={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <TaskModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveDetail}
        onDelete={handleDeleteTask}
      />

      <CreateTaskModal
        isOpen={isCreateOpen}
        initialStatus={createInitialStatus}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateTask}
        projectId={currentProjectId}
        projects={projects}
      />

      <DecomposerModal
        isOpen={isDecomposerOpen}
        onClose={() => setIsDecomposerOpen(false)}
        onSuccess={fetchTasks}
        projectId={currentProjectId}
        projects={projects}
      />
    </div>
  );
};

export default BoardView;
