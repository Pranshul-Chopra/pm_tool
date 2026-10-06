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
  AITicketPolicy,
  WorkspaceContext,
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
    decomposePRD: (payload: {
      project_id?: number;
      prd_text: string;
      target_persona?: string;
      story_count?: number;
      preview_only?: boolean;
    }) =>
      this.request<any>('/api/tools/breakdown', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    commitStories: (payload: { project_id?: number; stories: any[] }) =>
      this.request<any>('/api/tools/breakdown/commit', {
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
    createWidget: (
      dashboardId: number,
      data: {
        title: string;
        data_source_id: number;
        widget_type?: string;
        metric_op?: string;
        value_column?: string;
        group_by_column?: string;
        format_type?: string;
        target_value?: number;
      }
    ) =>
      this.request<any>(`/api/dashboards/${dashboardId}/widgets`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteWidget: (widgetId: number) =>
      this.request<{ status: string; id: number }>(`/api/dashboards/widgets/${widgetId}`, {
        method: 'DELETE',
      }),
    getWidgets: (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : '';
      return this.request<{ widgets: KPIWidget[] }>(`/api/data/widgets${q}`);
    },

    // Advanced Industry Analytics Engine (v2.1.0)
    getFunnelAnalysis: (payload: {
      source_id: number;
      stage_column: string;
      stages: string[];
      entity_column?: string;
    }) =>
      this.request<any>('/api/analytics/funnel', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getCohortRetention: (payload: {
      source_id: number;
      user_column: string;
      date_column: string;
      period_type?: string;
      max_periods?: number;
    }) =>
      this.request<any>('/api/analytics/retention', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getColumnStatistics: (payload: {
      source_id: number;
      column_name: string;
    }) =>
      this.request<any>('/api/analytics/statistics', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getCorrelationMatrix: (payload: {
      source_id: number;
      columns?: string[];
    }) =>
      this.request<any>('/api/analytics/correlation', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getTrendForecast: (payload: {
      source_id: number;
      date_column: string;
      metric_column: string;
      periods_ahead?: number;
      aggregation?: string;
    }) =>
      this.request<any>('/api/analytics/forecast', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

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

    // Document Generation & Export
    exportDocx: async (
      title: string,
      content: string,
      metadata?: Record<string, string>
    ): Promise<Blob> => {
      const url = `${this.apiBase}/api/export/docx`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Product Document',
          content: content,
          metadata: metadata || {
            Author: 'PM Tool AI Copilot',
            Date: new Date().toISOString().slice(0, 10),
            Status: 'Draft Spec',
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to generate DOCX document.');
      return res.blob();
    },

    exportMarkdown: async (title: string, content: string): Promise<Blob> => {
      const url = `${this.apiBase}/api/export/markdown`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Product Document',
          content: content,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate Markdown document.');
      return res.blob();
    },

    saveDocumentToKnowledgeBase: async (
      title: string,
      content: string,
      projectId?: number
    ): Promise<any> => {
      const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Document';
      const file = new File([content], `${cleanTitle}.md`, { type: 'text/markdown' });
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) {
        formData.append('project_id', projectId.toString());
      }
      return this.request<any>('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
    },

    summarizeDocument: (payload: {
      file_path?: string;
      doc_id?: number;
      output_path?: string;
      focus?: string;
      project_id?: number;
    }) =>
      this.request<any>('/api/documents/summarize', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    // ── Workspace Context & AI Policy Plane ─────────────────────────────
    getWorkspaceContext: (params?: { projectId?: number; query?: string }) => {
      const q = new URLSearchParams();
      if (params?.projectId) q.set('project_id', params.projectId.toString());
      if (params?.query) q.set('q', params.query);
      const queryString = q.toString() ? `?${q.toString()}` : '';
      return this.request<WorkspaceContext>(`/api/workspace/context${queryString}`);
    },

    getAIPolicies: () => this.request<AITicketPolicy>('/api/settings/ai-policies'),

    updateAIPolicies: (policy: Partial<AITicketPolicy>) =>
      this.request<AITicketPolicy>('/api/settings/ai-policies', {
        method: 'POST',
        body: JSON.stringify(policy),
      }),

    // ── Action Execution Plane (1-Click Apply) ───────────────────────────
    executeAction: (
      action: string,
      params: Record<string, any>,
      conversationId?: string,
      actionKey?: string
    ) =>
      this.request<{
        success: boolean;
        action: string;
        action_key?: string;
        task?: Task;
        message: string;
      }>('/api/tools/execute_action', {
        method: 'POST',
        body: JSON.stringify({
          action,
          params,
          conversation_id: conversationId,
          action_key: actionKey,
        }),
      }),

    getAppliedActions: (conversationId?: string) => {
      const q = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : '';
      return this.request<{
        applied_actions: any[];
        applied_action_keys: string[];
      }>(`/api/tools/applied_actions${q}`);
    },

    downloadBlob: (blob: Blob, filename: string) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
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
      return { version: '2.0.1', isPackaged: false, isPortable: false };
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
