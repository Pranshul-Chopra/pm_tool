import React, { useEffect, useState } from 'react';
import {
  Kanban,
  FileText,
  Database,
  Bot,
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { NavTab, Project, Task } from '../types';
import AppBridge from '../services/bridge';

interface HomeViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [projRes, taskRes] = await Promise.all([
          AppBridge.api.getProjects(),
          AppBridge.api.getTasks(),
        ]);
        if (mounted) {
          setProjects(projRes.projects || []);
          setTasks(taskRes.tasks || []);
        }
      } catch (err) {
        console.error('Failed to load workspace data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1a1918] to-[#222120] border border-[#2e2c2a] rounded-xl p-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#e8a84c]">
            Local-First Workstation · v2.0 Architecture
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#edeae4] mt-1">
            Product Workspace Overview
          </h1>
          <p className="text-sm text-[#9b9690] mt-1 max-w-xl">
            Autonomous product management with local RAG knowledge ingestion, Agile sprint tracking, and protected SQL analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('board')}
            className="px-3.5 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sprint Board</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#9b9690] font-medium">To Do / Backlog</span>
            <div className="text-2xl font-bold text-[#edeae4] mt-1 font-mono">{todoCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#222120] border border-[#2e2c2a] flex items-center justify-center text-[#9b9690]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#e8a84c] font-medium">In Progress</span>
            <div className="text-2xl font-bold text-[#e8a84c] mt-1 font-mono">{inProgressCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#e85c4c] font-medium">Blocked</span>
            <div className="text-2xl font-bold text-[#e85c4c] mt-1 font-mono">{blockedCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/20 flex items-center justify-center text-[#e85c4c]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5aab7f] font-medium">Completed</span>
            <div className="text-2xl font-bold text-[#5aab7f] mt-1 font-mono">{doneCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#5aab7f]/10 border border-[#5aab7f]/20 flex items-center justify-center text-[#5aab7f]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('board')}
          className="bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/40 rounded-xl p-5 cursor-pointer transition-all duration-150 group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c] mb-3 group-hover:scale-105 transition-transform">
            <Kanban className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#edeae4] group-hover:text-[#e8a84c] transition-colors">
            Agile Sprint Board
          </h3>
          <p className="text-xs text-[#9b9690] mt-1">
            Groom user stories, estimate Fibonacci story points, and manage sprint deliveries.
          </p>
          <div className="flex items-center gap-1 text-xs text-[#e8a84c] mt-4 font-medium">
            <span>Open Board</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('dashboard')}
          className="bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#4c97e8]/40 rounded-xl p-5 cursor-pointer transition-all duration-150 group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#4c97e8]/10 border border-[#4c97e8]/20 flex items-center justify-center text-[#4c97e8] mb-3 group-hover:scale-105 transition-transform">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#edeae4] group-hover:text-[#4c97e8] transition-colors">
            Data Studio & KPIs
          </h3>
          <p className="text-xs text-[#9b9690] mt-1">
            Query datasets with read-only guarded SQL and visualize real-time benchmarks.
          </p>
          <div className="flex items-center gap-1 text-xs text-[#4c97e8] mt-4 font-medium">
            <span>Explore Data</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('chat')}
          className="bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#5aab7f]/40 rounded-xl p-5 cursor-pointer transition-all duration-150 group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#5aab7f]/10 border border-[#5aab7f]/20 flex items-center justify-center text-[#5aab7f] mb-3 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#edeae4] group-hover:text-[#5aab7f] transition-colors">
            AI Copilot & PRD Generator
          </h3>
          <p className="text-xs text-[#9b9690] mt-1">
            Draft PRDs, decompose initiatives, and interrogate past organizational decisions.
          </p>
          <div className="flex items-center gap-1 text-xs text-[#5aab7f] mt-4 font-medium">
            <span>Launch Copilot</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Active Tasks Table Preview */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#edeae4]">Recent User Stories</h3>
          <button
            onClick={() => onNavigate('board')}
            className="text-xs text-[#e8a84c] hover:underline flex items-center gap-1"
          >
            <span>View all stories</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-[#9b9690] py-8 text-center font-mono animate-pulse">
            Loading workspace entities...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-xs text-[#9b9690] py-8 text-center">
            No user stories created yet. Jump into Sprint Board to create your first story!
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#222120] border border-[#2e2c2a] text-xs hover:border-[#3a3835] transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      task.status === 'done'
                        ? 'bg-[#5aab7f]'
                        : task.status === 'in_progress'
                        ? 'bg-[#e8a84c]'
                        : task.status === 'blocked'
                        ? 'bg-[#e85c4c]'
                        : 'bg-[#9b9690]'
                    }`}
                  />
                  <span className="font-medium text-[#edeae4] truncate">{task.title}</span>
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
                        : 'bg-[#2e2c2a] text-[#9b9690] border-[#3a3835]'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeView;
