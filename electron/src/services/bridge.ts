import type {
  Project,
  CreateProjectPayload,
  Task,
  Decision,
  KnowledgeDocument,
  DataSource,
  KPIWidget,
  UpdateData,
  LLMStatus,
  LLMConfigPayload,
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
    getProjects: (params?: { search?: string; status?: string; health?: string; domain?: string }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.health) q.set('health', params.health);
      if (params?.domain) q.set('domain', params.domain);
      const queryString = q.toString() ? `?${q.toString()}` : '';
      return this.request<{ projects: Project[]; count?: number }>(`/api/projects${queryString}`);
    },
    getProject: (id: number) => this.request<{ project: Project; tasks: Task[] }>(`/api/projects/${id}`),
    createProject: async (payload: string | CreateProjectPayload, description?: string): Promise<Project> => {
      const body = typeof payload === 'string' ? { name: payload, description } : payload;
      const res = await this.request<any>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.project || res;
    },
    updateProject: (id: number, patch: Partial<Project>) =>
      this.request<Project>(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    deleteProject: (id: number) =>
      this.request<{ status: string; id: number }>(`/api/projects/${id}`, {
        method: 'DELETE',
      }),
    getProjectTasks: (id: number) =>
      this.request<{ tasks: Task[] }>(`/api/projects/${id}/tasks`),

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
    getDocuments: (projectId?: number, fileType?: string) => {
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId.toString());
      if (fileType) params.set('file_type', fileType);
      const query = params.toString() ? `?${params.toString()}` : '';
      return this.request<{ documents: KnowledgeDocument[]; count: number; total_chunks: number }>(`/api/documents${query}`);
    },
    uploadDocument: (formData: FormData) =>
      this.request<{ success?: boolean; document?: KnowledgeDocument; chunks_count?: number; error?: string }>('/api/documents/upload', {
        method: 'POST',
        body: formData,
      }),
    deleteDocument: (id: number) =>
      this.request<{ status: string; id: number }>(`/api/documents/${id}`, {
        method: 'DELETE',
      }),
    getDocumentChunks: (id: number) =>
      this.request<{ document: KnowledgeDocument; chunks: any[]; count: number }>(`/api/documents/${id}/chunks`),
    queryDocuments: (query: string, projectId?: number, topK = 5) =>
      this.request<{ query: string; chunks: any[]; count: number }>('/api/documents/query', {
        method: 'POST',
        body: JSON.stringify({ query, project_id: projectId, top_k: topK }),
      }),

    // AI Copilot & Conversations
    getConversations: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ conversations: any[] }>(`/api/conversations${q}`);
    },
    getConversation: (convId: string) =>
      this.request<{ conversation: any; messages: any[] }>(`/api/conversations/${convId}`),
    deleteConversation: (convId: string) =>
      this.request<{ status: string; id: string }>(`/api/conversations/${convId}`, {
        method: 'DELETE',
      }),
    sendChatMessage: (payload: { message: string; conversation_id?: string; project_id?: number }) =>
      this.request<{
        response: string;
        provider?: string;
        model?: string;
        conversation_id: string;
        conversation_title: string;
        sources?: any[];
      }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // Data Studio & Analytics
    getDataSources: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ data_sources: DataSource[] }>(`/api/data/sources${q}`);
    },
    uploadDataSource: (formData: FormData) =>
      this.request<{ success: boolean; data_source: DataSource }>('/api/data/sources/upload', {
        method: 'POST',
        body: formData,
      }),
    deleteDataSource: (id: number) =>
      this.request<{ status: string; id: number }>(`/api/data/sources/${id}`, {
        method: 'DELETE',
      }),
    getDataSourcePreview: (id: number, limit = 50) =>
      this.request<{ columns: string[]; rows: any[][]; row_count: number; total_rows: number }>(
        `/api/data/sources/${id}/preview?limit=${limit}`
      ),
    executeSafeSQL: (dataSourceId: number, sql: string, maxRows = 100) =>
      this.request<{
        success: boolean;
        columns: string[];
        rows: any[][];
        row_count: number;
        execution_time_ms: number;
        error?: string;
      }>('/api/data/query', {
        method: 'POST',
        body: JSON.stringify({ data_source_id: dataSourceId, query: sql, max_rows: maxRows }),
      }),
    getDashboards: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ dashboards: any[]; count: number }>(`/api/dashboards${q}`);
    },
    getDashboardDetail: (id: number) =>
      this.request<{ dashboard: any; widgets: any[] }>(`/api/dashboards/${id}`),
    createDashboard: (data: { title: string; description?: string; data_source_id?: number; project_id?: number }) =>
      this.request<any>('/api/dashboards', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getWidgets: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ widgets: KPIWidget[] }>(`/api/data/widgets${q}`);
    },

    // Decisions
    getDecisions: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ decisions: Decision[] }>(`/api/decisions${q}`);
    },

    // LLM Gateway & Provider Configuration
    getLLMStatus: () => this.request<LLMStatus>('/api/llm/status'),

    saveLLMConfig: (payload: LLMConfigPayload) =>
      this.request<{ success?: boolean; error?: string; message?: string }>('/api/llm/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    probeOllama: () =>
      this.request<{
        available: boolean;
        models: string[];
        selected_model?: string;
        warning?: string;
      }>('/api/llm/ollama/probe'),

    getOllamaModels: () =>
      this.request<{
        available: boolean;
        models: string[];
        warning?: string;
      }>('/api/llm/ollama/models'),

    discoverGeminiModels: (apiKey?: string) =>
      this.request<{ models: string[]; count: number; error?: string }>('/api/llm/gemini/models', {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey }),
      }),

    probeCustomLLM: (url: string) =>
      this.request<{ ok: boolean; message: string; models?: string[]; error?: string }>('/api/llm/custom/probe', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
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
