import type {
  Project,
  Task,
  Decision,
  KnowledgeDocument,
  DataSource,
  KPIWidget,
  UpdateData,
} from '../types';

class BridgeService {
  private apiBase: string;

  constructor() {
    this.apiBase = '';
  }

  public setBaseUrl(url: string) {
    this.apiBase = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.apiBase;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson && (errorJson.error || errorJson.message)) {
          errorMessage = errorJson.error || errorJson.message;
        }
      } catch (_) {}
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ── Data API Plane ─────────────────────────────────────────────────────────
  public api = {
    ping: () => this.request<{ app: string; status: string }>('/api/ping'),
    getVersion: () => this.request<{ version: string; app_name: string; build_date: string }>('/api/version'),

    // Projects
    getProjects: () => this.request<{ projects: Project[] }>('/api/projects'),
    createProject: (name: string, description?: string) =>
      this.request<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),

    // Tasks / Kanban Tickets
    getTasks: (projectId?: number, status?: string) => {
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId.toString());
      if (status) params.set('status', status);
      const query = params.toString() ? `?${params.toString()}` : '';
      return this.request<{ tasks: Task[] }>(`/api/tasks${query}`);
    },
    createTask: async (task: Partial<Task>): Promise<Task> => {
      const res = await this.request<any>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
      return res.task || res;
    },
    updateTask: async (id: number, patch: Partial<Task>): Promise<Task> => {
      const res = await this.request<any>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return res.task || res;
    },
    deleteTask: async (id: number): Promise<{ success: boolean; id: number }> => {
      const res = await this.request<any>(`/api/tasks/${id}`, {
        method: 'DELETE',
      });
      return { success: res.status === 'deleted' || res.success === true, id: res.id || id };
    },
    getTaskMetrics: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<any>(`/api/tasks/metrics${q}`);
    },
    decomposePRD: (payload: { project_id?: number; prd_text: string }) =>
      this.request<any>('/api/tools/breakdown', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // Knowledge Base Documents
    getDocuments: () => this.request<{ documents: KnowledgeDocument[] }>('/api/documents'),
    uploadDocument: (formData: FormData) =>
      this.request<{ success: boolean; document: KnowledgeDocument }>('/api/documents/upload', {
        method: 'POST',
        body: formData,
      }),
    deleteDocument: (id: number) =>
      this.request<{ success: boolean; id: number }>(`/api/documents/${id}`, {
        method: 'DELETE',
      }),

    // Data Studio & Analytics
    getDataSources: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ data_sources: DataSource[] }>(`/api/data/sources${q}`);
    },
    getWidgets: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ widgets: KPIWidget[] }>(`/api/data/widgets${q}`);
    },
    executeSafeSQL: (dataSourceId: number, sql: string, maxRows = 100) =>
      this.request<{
        success: boolean;
        columns: string[];
        rows: any[][];
        row_count: number;
        execution_time_ms: number;
        error?: string;
      }>('/api/data/sandbox/query', {
        method: 'POST',
        body: JSON.stringify({ data_source_id: dataSourceId, sql_query: sql, max_rows: maxRows }),
      }),

    // Decisions
    getDecisions: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ decisions: Decision[] }>(`/api/decisions${q}`);
    },
  };

  // ── Native OS Plane ────────────────────────────────────────────────────────
  public os = {
    isElectron: typeof window !== 'undefined' && Boolean(window.electronUpdater || window.electronEnv),
    
    checkForUpdates: () => {
      if (window.electronUpdater) {
        window.electronUpdater.checkForUpdates();
      }
    },

    restartAndInstallUpdate: () => {
      if (window.electronUpdater) {
        window.electronUpdater.restartAndInstall();
      }
    },

    onUpdateStatus: (callback: (data: UpdateData) => void) => {
      if (window.electronUpdater) {
        return window.electronUpdater.onStatus(callback);
      }
      return () => {};
    },

    getUpdaterInfo: async () => {
      if (window.electronUpdater) {
        return await window.electronUpdater.getInfo();
      }
      return { version: '1.4.0', isPackaged: false, isPortable: false };
    },

    notify: (title: string, body: string) => {
      if (window.electronNotifier) {
        window.electronNotifier.sendNotification({ title, body });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    },
  };
}

export const AppBridge = new BridgeService();
export default AppBridge;
