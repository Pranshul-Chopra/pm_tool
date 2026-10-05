export type NavTab = 'home' | 'board' | 'dashboard' | 'documents' | 'chat' | 'settings';

export type UpdateStatus = 
  | 'idle' 
  | 'checking' 
  | 'available' 
  | 'not-available' 
  | 'downloading' 
  | 'downloaded' 
  | 'error' 
  | 'dev-mode';

export interface UpdateData {
  status: UpdateStatus;
  version?: string;
  releaseDate?: string;
  isPortable?: boolean;
  downloadUrl?: string | null;
  percent?: number;
  message?: string;
  error?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  domain?: string;
  priority?: string;
  health?: string;
  owner?: string;
  target_date?: string;
  goals?: string;
  tech_stack?: string;
  status?: string;
  task_count?: number;
  done_task_count?: number;
  in_progress_task_count?: number;
  todo_task_count?: number;
  progress_pct?: number;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProjectPayload {
  name: string;
  domain?: string;
  priority?: string;
  health?: string;
  owner?: string;
  target_date?: string;
  goals?: string;
  tech_stack?: string;
  description?: string;
  seed_tasks?: boolean;
  initial_tasks?: Array<[string, string] | string>;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'med' | 'high' | 'urgent';

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  story_points?: number;
  acceptance_criteria?: string;
  assignee?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Decision {
  id: number;
  project_id: number;
  title: string;
  rationale: string;
  impact?: string;
  created_at: string;
}

export interface KnowledgeDocument {
  id: number;
  project_id?: number | null;
  project_name?: string | null;
  filename: string;
  file_type: string;
  file_size?: number;
  chunk_count: number;
  word_count: number;
  status: string;
  created_at: string;
}

export interface DataSource {
  id: number;
  project_id: number;
  name: string;
  file_type: string;
  row_count: number;
  column_count: number;
  table_name: string;
  columns_json?: string;
  created_at: string;
}

export interface KPIWidget {
  id: number;
  project_id: number;
  data_source_id: number;
  title: string;
  widget_type: 'kpi_card' | 'bar_chart' | 'donut_chart' | 'table';
  operation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  target_column: string;
  group_by_column?: string;
  format_type: 'number' | 'currency' | 'percent';
  target_value?: number;
  position: number;
  created_at: string;
}

export type LLMProviderPref = 'auto' | 'ollama' | 'api';

export interface LLMStatus {
  active_provider: string;
  active_model: string;
  ollama: {
    available: boolean;
    models: string[];
    selected_model?: string;
    warning?: string;
  };
  api_configured: boolean;
  api_key_display?: string;
  api_base?: string;
  saved_model?: string;
  saved_provider_pref?: string;
  setup_required: boolean;
}

export interface LLMConfigPayload {
  provider: LLMProviderPref;
  api_key?: string;
  api_base?: string;
  model_name?: string;
}

