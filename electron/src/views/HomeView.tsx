import React, { useEffect, useState, useMemo } from 'react';
import {
  Kanban,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Rocket,
  Shield,
  RefreshCw,
} from 'lucide-react';
import type { NavTab, Project, Task } from '../types';
import AppBridge from '../services/bridge';
import ProjectCard from '../components/projects/ProjectCard';
import CreateProjectModal from '../components/projects/CreateProjectModal';
import ProjectDetailModal from '../components/projects/ProjectDetailModal';
import DeleteProjectModal from '../components/projects/DeleteProjectModal';

interface HomeViewProps {
  onNavigate: (tab: NavTab, projectId?: number | null) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');

  // Modals State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        AppBridge.api.getProjects(),
        AppBridge.api.getTasks(),
      ]);
      setProjects(projRes.projects || []);
      setTasks(taskRes.tasks || []);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProjectCreated = (newProj: Project) => {
    setProjects((prev) => [newProj, ...prev]);
    loadData(); // Re-fetch to ensure seeded tasks are loaded
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmProject) return;
    setDeleting(true);
    try {
      await AppBridge.api.deleteProject(deleteConfirmProject.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteConfirmProject.id));
      setDeleteConfirmProject(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.goals && p.goals.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.owner && p.owner.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDomain = filterDomain === 'all' || p.domain === filterDomain;
      const matchesHealth = filterHealth === 'all' || p.health === filterHealth;

      return matchesSearch && matchesDomain && matchesHealth;
    });
  }, [projects, searchQuery, filterDomain, filterHealth]);

  // Derived Task Metrics
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const velocityRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#1a1918] to-[#222120] border border-[#2e2c2a] rounded-xl p-6">
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
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          <button
            onClick={() => onNavigate('board')}
            className="px-3.5 py-2 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[#edeae4] font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Kanban className="w-3.5 h-3.5 text-[#e8a84c]" />
            <span>Sprint Board</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#9b9690] font-medium">Active Initiatives</span>
            <div className="text-2xl font-bold text-[#edeae4] mt-1 font-mono">{projects.length}</div>
            <span className="text-[11px] text-[#78746f] mt-0.5 block">
              {projects.length === 1 ? '1 project tracked' : `${projects.length} projects tracked`}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#222120] border border-[#2e2c2a] flex items-center justify-center text-[#e8a84c]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#5aab7f] font-medium">Sprint Completion</span>
            <div className="text-2xl font-bold text-[#5aab7f] mt-1 font-mono">{velocityRate}%</div>
            <span className="text-[11px] text-[#78746f] mt-0.5 block">
              {doneCount} of {totalTasks} stories done
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#5aab7f]/10 border border-[#5aab7f]/20 flex items-center justify-center text-[#5aab7f]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#e8a84c] font-medium">In Progress</span>
            <div className="text-2xl font-bold text-[#e8a84c] mt-1 font-mono">{inProgressCount}</div>
            <span className="text-[11px] text-[#78746f] mt-0.5 block">
              {blockedCount} currently blocked
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#9b9690] font-medium">Backlog Stories</span>
            <div className="text-2xl font-bold text-[#edeae4] mt-1 font-mono">{todoCount}</div>
            <span className="text-[11px] text-[#78746f] mt-0.5 block">
              {blockedCount > 0 ? `${blockedCount} require triage` : 'All lanes active'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#222120] border border-[#2e2c2a] flex items-center justify-center text-[#9b9690]">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        {/* Projects Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#edeae4]">Initiatives & Roadmap</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#222120] border border-[#2e2c2a] text-[#9b9690]">
              {filteredProjects.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search initiatives..."
                className="w-full bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#edeae4] focus:outline-none"
              />
            </div>

            {/* Domain Filter */}
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
            >
              <option value="all">All Domains</option>
              <option value="Platform">Platform</option>
              <option value="Growth">Growth</option>
              <option value="Security">Security</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Mobile">Mobile</option>
              <option value="Enterprise">Enterprise</option>
              <option value="AI/ML">AI/ML</option>
            </select>

            {/* Health Filter */}
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value)}
              className="bg-[#1a1918] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
            >
              <option value="all">All Health</option>
              <option value="on_track">🟢 On Track</option>
              <option value="planning">🔵 Planning</option>
              <option value="at_risk">🟡 At Risk</option>
              <option value="blocked">🔴 Blocked</option>
            </select>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
              title="Refresh initiatives"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e8a84c]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-[#9b9690] animate-pulse bg-[#1a1918] rounded-xl border border-[#2e2c2a]">
            Loading workspace initiatives...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#e8a84c]/10 border border-[#e8a84c]/20 flex items-center justify-center text-[#e8a84c] mx-auto mb-3">
              <Rocket className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#edeae4]">No initiatives found</h3>
            <p className="text-xs text-[#9b9690] mt-1 max-w-md mx-auto leading-relaxed">
              {projects.length === 0
                ? 'Get started by creating your first product initiative or load one of our enterprise templates.'
                : 'No initiatives matched your search or filters. Try adjusting your criteria.'}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Initiative</span>
              </button>
              {projects.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDomain('all');
                    setFilterHealth('all');
                  }}
                  className="px-3.5 py-1.5 bg-[#222120] hover:bg-[#282725] text-xs text-[#edeae4] border border-[#2e2c2a] rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpenDetail={(p) => setDetailProject(p)}
                onOpenInBoard={(pId) => onNavigate('board', pId)}
                onDiscussInCopilot={(pId) => onNavigate('chat', pId)}
                onDelete={(p) => setDeleteConfirmProject(p)}
              />
            ))}
          </div>
        )}
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

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleProjectCreated}
      />

      <ProjectDetailModal
        isOpen={!!detailProject}
        project={detailProject}
        onClose={() => setDetailProject(null)}
        onOpenInBoard={(pId) => onNavigate('board', pId)}
        onDiscussInCopilot={(pId) => onNavigate('chat', pId)}
        onProjectUpdated={loadData}
      />

      <DeleteProjectModal
        isOpen={!!deleteConfirmProject}
        project={deleteConfirmProject}
        loading={deleting}
        onClose={() => setDeleteConfirmProject(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default HomeView;
