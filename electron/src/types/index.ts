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
  ticket_type?: 'internal' | 'external';
  story_points?: number;
  acceptance_criteria?: string;
  assignee?: string;
  due_date?: string;
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

export type TicketAccessScope = 'all' | 'internal_only' | 'external_only' | 'none';

export interface AITicketPolicy {
  access_scope: TicketAccessScope;
  creation_allowed: boolean;
}

export interface WorkspaceContext {
  policy: {
    access_scope: TicketAccessScope;
    creation_allowed: boolean;
    status: string;
  };
  target_project?: Project;
  projects: Project[];
  open_tickets: Task[];
  completed_tickets_count: number;
  docs: Array<{
    id: number;
    project_id?: number | null;
    filename: string;
    file_type: string;
    word_count: number;
    chunk_count: number;
    created_at: string;
  }>;
  matched_docs: Array<{
    id: number;
    filename: string;
    file_type: string;
  }>;
  datasets: Array<{
    id: number;
    name: string;
    file_type: string;
    row_count: number;
    column_count: number;
    table_name: string;
  }>;
  kpis: KPIWidget[];
}

export interface ActionProposal {
  action: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  story_points?: number;
  ticket_type?: 'internal' | 'external';
  project_id?: number;
  assignee?: string;
  acceptance_criteria?: string;
  [key: string]: any;
}

export type ArtifactDocType = 'prd' | 'rfc' | 'brief' | 'architecture' | 'notes' | 'breakdown' | 'document';

export interface Artifact {
  id: number;
  uuid: string;
  project_id?: number | null;
  title: string;
  doc_type: ArtifactDocType | string;
  content: string;
  summary?: string;
  tags: string[];
  is_pinned: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  id: number;
  artifact_id: number;
  version_num: number;
  title: string;
  summary?: string;
  created_at: string;
  byte_size?: number;
}

export interface ArtifactSummaryStats {
  total_count: number;
  prd_count: number;
  rfc_count: number;
  brief_count: number;
  pinned_count: number;
  total_words: number;
}

export interface CreateArtifactPayload {
  title: string;
  content?: string;
  doc_type?: string;
  project_id?: number | null;
  tags?: string[];
  summary?: string;
  is_pinned?: boolean;
}

export interface UpdateArtifactPayload {
  title?: string;
  content?: string;
  doc_type?: string;
  project_id?: number | null;
  tags?: string[];
  summary?: string;
  is_pinned?: boolean;
  create_version?: boolean;
  version_summary?: string;
}

export interface OnboardingConfig {
  projectName: string;
  domain: string;
  techStack: string;
  seedBacklog: boolean;
  provider: 'ollama' | 'gemini' | 'openai' | 'offline';
  ollamaModel?: string;
  apiKey?: string;
  apiBase?: string;
}


