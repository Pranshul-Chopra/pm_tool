import React, { useEffect, useState, useRef } from 'react';
import {
  Database,
  Play,
  Table,
  Upload,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Layers,
  Sparkles,
  TrendingUp,
  LayoutGrid,
  CheckCircle,
  Plus,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { DataSource, KPIWidget } from '../types';
import AppBridge from '../services/bridge';
import DeleteDatasetModal from '../components/studio/DeleteDatasetModal';
import AddWidgetModal from '../components/studio/AddWidgetModal';
import AdvancedAnalyticsWorkbench from '../components/studio/AdvancedAnalyticsWorkbench';

export const StudioView: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'sandbox' | 'dashboard' | 'analytics'
  const [activeTab, setActiveTab] = useState<'sandbox' | 'dashboard' | 'analytics'>('sandbox');

  // SQL Sandbox State
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM data LIMIT 25;');
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard / KPI Widgets State
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState<number | null>(null);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);

  // Modals State
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<DataSource | null>(null);
  const [deletingSource, setDeletingSource] = useState(false);

  const fetchStudioData = async () => {
    setLoading(true);
    try {
      const dsRes = await AppBridge.api.getDataSources();
      const sources = dsRes.data_sources || (dsRes as any).sources || [];
      setDataSources(sources);

      if (sources.length > 0 && !selectedSourceId) {
        setSelectedSourceId(sources[0].id);
        setSqlQuery(`SELECT * FROM "${sources[0].table_name || 'data'}" LIMIT 25;`);
      }
    } catch (err) {
      console.error('Failed to load data sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudioData();
  }, []);

  // When selected dataset changes, load quick preview and update default query
  useEffect(() => {
    if (selectedSourceId) {
      const source = dataSources.find((s) => s.id === selectedSourceId);
      if (source) {
        const defaultSql = `SELECT * FROM "${source.table_name || 'data'}" LIMIT 25;`;
        setSqlQuery(defaultSql);
        runQuery(selectedSourceId, defaultSql);
      }
    }
  }, [selectedSourceId]);

  // Load KPI widgets when dashboard tab is active
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardWidgets();
    }
  }, [activeTab, selectedSourceId]);

  const loadDashboardWidgets = async () => {
    setLoadingWidgets(true);
    try {
      const res = await AppBridge.api.getDashboards();
      const dashboards = Array.isArray(res?.dashboards) ? res.dashboards : [];
      let dashId = dashboards.length > 0 ? dashboards[0].id : null;

      if (!dashId) {
        // Auto-provision default KPI dashboard if none exists
        try {
          const created = await AppBridge.api.createDashboard({ title: 'Analytics & KPI Dashboard' });
          if (created?.id) {
            dashId = created.id;
          } else if (created?.dashboard?.id) {
            dashId = created.dashboard.id;
          }
        } catch (createErr) {
          console.warn('Could not auto-create dashboard:', createErr);
        }
      }

      setActiveDashboardId(dashId);

      if (dashId) {
        const detail = await AppBridge.api.getDashboardDetail(dashId);
        const wList = Array.isArray(detail?.widgets) ? detail.widgets : [];
        setWidgets(wList);
      } else {
        // Fallback to general widgets
        const wRes = await AppBridge.api.getWidgets();
        const wList = Array.isArray(wRes?.widgets) ? wRes.widgets : [];
        setWidgets(wList);
      }
    } catch (err) {
      console.error('Failed to load dashboard widgets:', err);
      setWidgets([]);
    } finally {
      setLoadingWidgets(false);
    }
  };

  const runQuery = async (sourceId: number, query: string) => {
    setLoadingQuery(true);
    setQueryError(null);
    try {
      const res = await AppBridge.api.executeSafeSQL(sourceId, query, 100);
      setQueryResult(res);
    } catch (err: any) {
      setQueryError(err.message || 'Execution failed');
      setQueryResult(null);
    } finally {
      setLoadingQuery(false);
    }
  };

  const handleRunQuery = () => {
    if (!selectedSourceId) return;
    runQuery(selectedSourceId, sqlQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    setUploading(true);
    setUploadStatus(null);

    try {
      const res = await AppBridge.api.uploadDataSource(formData);
      const dsRecord = res.data_source || (res as any);
      if (res.success || dsRecord.id || dsRecord.table_name) {
        const rowCount = res.data_source?.row_count ?? (dsRecord as any).row_count ?? 0;
        setUploadStatus({
          type: 'success',
          message: `Dataset "${file.name}" materialized with ${rowCount} rows.`,
        });
        await fetchStudioData();
        if (dsRecord.id) {
          setSelectedSourceId(dsRecord.id);
        }
      } else {
        setUploadStatus({ type: 'error', message: (res as any).error || 'Ingestion failed.' });
      }
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Failed to ingest file.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSource = (source: DataSource) => {
    setDeleteConfirmSource(source);
  };

  const handleConfirmDeleteSource = async () => {
    if (!deleteConfirmSource) return;
    setDeletingSource(true);
    try {
      await AppBridge.api.deleteDataSource(deleteConfirmSource.id);
      setDataSources((prev) => prev.filter((s) => s.id !== deleteConfirmSource.id));
      if (selectedSourceId === deleteConfirmSource.id) {
        setSelectedSourceId(null);
        setQueryResult(null);
      }
      setDeleteConfirmSource(null);
      if (activeTab === 'dashboard') {
        loadDashboardWidgets();
      }
    } catch (err: any) {
      console.error('Failed to delete dataset:', err);
      alert(`Failed to delete dataset: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingSource(false);
    }
  };

  const handleDeleteWidget = async (widgetId: number) => {
    try {
      await AppBridge.api.deleteWidget(widgetId);
      setWidgets((prev) => prev.filter((w) => (w.id || w.widget_id) !== widgetId));
    } catch (err: any) {
      console.error('Failed to delete widget:', err);
    }
  };

  const exportToCSV = () => {
    if (!queryResult || !Array.isArray(queryResult.columns) || !Array.isArray(queryResult.rows)) return;
    const cols = queryResult.columns;
    const headers = cols.join(',');
    const rows = queryResult.rows
      .map((r: any) => {
        const cells = Array.isArray(r) ? r : cols.map((colName: string) => r?.[colName]);
        return cells.map((val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',');
      })
      .join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'query_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeSource = dataSources.find((s) => s.id === selectedSourceId);

  // Parse columns json
  let parsedColumns: { name: string; type: string }[] = [];
  const rawCols = activeSource?.columns_json || (activeSource as any)?.schema_json;
  if (rawCols) {
    try {
      const parsed = typeof rawCols === 'string' ? JSON.parse(rawCols) : rawCols;
      parsedColumns = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      parsedColumns = [];
    }
  }

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-5">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#2e2c2a] flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">
              Data Studio & Analytical Sandbox
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#4c97e8]/10 text-[#4c97e8] border border-[#4c97e8]/30 font-semibold">
              Guarded AST Sandbox
            </span>
          </div>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Materialize SQLite databases (.db, .sqlite), CSV, Excel, and JSON datasets into analytical tables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex items-center bg-[#1a1918] border border-[#2e2c2a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'sandbox'
                  ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                  : 'text-[#9b9690] hover:text-[#edeae4]'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>SQL Sandbox</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                  : 'text-[#9b9690] hover:text-[#edeae4]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>KPI Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                  : 'text-[#9b9690] hover:text-[#edeae4]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Advanced Analytics</span>
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <button
              onClick={() => setIsAddWidgetOpen(true)}
              disabled={dataSources.length === 0}
              className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-40 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title={dataSources.length === 0 ? 'Upload a dataset first' : 'Add KPI metric or chart'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add KPI Metric</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".db,.sqlite,.sqlite3,.csv,.tsv,.xlsx,.xls,.json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`px-3.5 py-1.5 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${
              activeTab === 'dashboard'
                ? 'bg-[#222120] hover:bg-[#282725] text-[#edeae4] border border-[#2e2c2a]'
                : 'bg-[#e8a84c] hover:bg-[#d4973b] text-black disabled:opacity-50'
            }`}
          >
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin text-[#e8a84c]' : ''}`} />
            <span>{uploading ? 'Materializing...' : 'Upload Dataset'}</span>
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            uploadStatus.type === 'success'
              ? 'bg-[#5aab7f]/10 border border-[#5aab7f]/30 text-[#5aab7f]'
              : 'bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c]'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{uploadStatus.message}</span>
          </div>
          <button onClick={() => setUploadStatus(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Viewport */}
      {activeTab === 'sandbox' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden min-h-0">
          {/* Left: Datasets & Schema Browser (3 cols) */}
          <div className="lg:col-span-3 flex flex-col bg-[#161514] border border-[#2e2c2a] rounded-xl overflow-hidden min-h-0">
            <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918] text-xs font-semibold text-[#edeae4]">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#e8a84c]" />
                <span>Datasets ({dataSources.length})</span>
              </span>
              <button onClick={fetchStudioData} title="Refresh datasets" className="text-[#9b9690] hover:text-[#edeae4]">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {Array.isArray(dataSources) && dataSources.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => setSelectedSourceId(ds.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    selectedSourceId === ds.id
                      ? 'bg-[#222120] border-[#e8a84c]/50 text-[#edeae4]'
                      : 'bg-[#1a1918] border-[#2e2c2a] text-[#9b9690] hover:border-[#3a3835]'
                  }`}
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#edeae4] truncate">{ds.name}</div>
                    <div className="text-[10px] text-[#5c5955] font-mono mt-0.5">
                      {ds.row_count} rows · {ds.column_count} cols · {ds.file_type || (ds as any).source_type || 'tabular'}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSource(ds);
                    }}
                    className="p-1 text-[#5c5955] hover:text-[#e85c4c] rounded transition-colors"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {(!Array.isArray(dataSources) || dataSources.length === 0) && !loading && (
                <div className="text-center py-8 text-xs text-[#5c5955] p-4">
                  No datasets uploaded. Ingest an SQLite database, Excel, CSV, or JSON file to start analyzing.
                </div>
              )}
            </div>

            {/* Schema Column Pills */}
            {Array.isArray(parsedColumns) && parsedColumns.length > 0 && (
              <div className="p-3 border-t border-[#2e2c2a] bg-[#1a1918]/60 flex flex-col max-h-48 overflow-y-auto">
                <span className="text-[11px] font-mono text-[#9b9690] mb-2 font-semibold">
                  Columns ({parsedColumns.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {parsedColumns.map((col, idx) => (
                    <span
                      key={idx}
                      onClick={() => setSqlQuery((prev) => `${prev} "${col.name}"`)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] hover:bg-[#282725] text-[#edeae4] border border-[#2e2c2a] cursor-pointer hover:border-[#e8a84c]/50"
                      title={`Click to insert column name (${col.type})`}
                    >
                      {col.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: SQL Editor & Results Table (9 cols) */}
          <div className="lg:col-span-9 flex flex-col space-y-4 overflow-hidden min-h-0">
            {/* Editor Box */}
            <div className="bg-[#161514] border border-[#2e2c2a] rounded-xl p-4 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#e8a84c]">
                    SQL Sandbox Editor
                  </span>
                  <span className="text-[10px] font-mono text-[#5c5955]">Ctrl + Enter to run</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    disabled={!queryResult?.rows?.length}
                    className="px-2.5 py-1 rounded bg-[#222120] hover:bg-[#282725] disabled:opacity-40 border border-[#2e2c2a] text-xs text-[#9b9690] hover:text-[#edeae4] transition-colors flex items-center gap-1.5"
                    title="Export results to CSV"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handleRunQuery}
                    disabled={loadingQuery || !selectedSourceId}
                    className="px-3 py-1 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-40 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Play className={`w-3.5 h-3.5 ${loadingQuery ? 'animate-spin' : ''}`} />
                    <span>{loadingQuery ? 'Running...' : 'Execute Query'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg p-3 font-mono text-xs text-[#edeae4] focus:outline-none resize-none leading-relaxed"
                placeholder="SELECT * FROM data LIMIT 25;"
              />
            </div>

            {queryError && (
              <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{queryError}</span>
              </div>
            )}

            {/* Results Grid */}
            <div className="flex-1 bg-[#161514] border border-[#2e2c2a] rounded-xl flex flex-col overflow-hidden min-h-0">
              <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between text-xs text-[#9b9690] bg-[#1a1918] flex-shrink-0">
                <span>Query Output Preview</span>
                {queryResult && (
                  <span className="font-mono text-[11px] text-[#5aab7f]">
                    {queryResult.row_count} rows in {queryResult.execution_time_ms}ms
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-2">
                {queryResult && Array.isArray(queryResult.columns) && queryResult.columns.length > 0 ? (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#2e2c2a] text-[#9b9690] bg-[#1a1918]/80 sticky top-0 z-10 text-left">
                        {queryResult.columns.map((col: string, idx: number) => (
                          <th key={idx} className="p-2.5 font-mono font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(queryResult.rows) &&
                        queryResult.rows.map((row: any, rIdx: number) => {
                          const cells = Array.isArray(row)
                            ? row
                            : (queryResult.columns || []).map((colName: string) => row?.[colName]);
                          return (
                            <tr
                              key={rIdx}
                              className="border-b border-[#222120] hover:bg-[#222120]/60 font-mono text-[11px]"
                            >
                              {Array.isArray(cells) &&
                                cells.map((cell: any, cIdx: number) => (
                                  <td key={cIdx} className="p-2.5 text-[#edeae4]">
                                    {cell !== null && cell !== undefined ? String(cell) : 'NULL'}
                                  </td>
                                ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-[#5c5955] p-6 text-center">
                    <Table className="w-8 h-8 mb-2 opacity-40 text-[#4c97e8]" />
                    <span>Run a query to inspect records and schema profiles.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── KPI Dashboard View ────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {(() => {
            const allWidgets = Array.isArray(widgets) ? widgets : [];
            const kpiCards = allWidgets.filter((w) => w.widget_type === 'kpi_card' || !w.widget_type);
            const chartWidgets = allWidgets.filter(
              (w) => w.widget_type === 'bar_chart' || w.widget_type === 'donut_chart' || w.widget_type === 'pie_chart'
            );

            if (allWidgets.length === 0 && !loadingWidgets) {
              return (
                <div className="py-16 text-center text-xs text-[#5c5955] bg-[#1a1918] border border-dashed border-[#2e2c2a] rounded-xl p-8 max-w-lg mx-auto flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#e8a84c]/10 border border-[#e8a84c]/30 flex items-center justify-center text-[#e8a84c] mb-3 shadow-inner">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm text-[#edeae4]">No KPI Metrics or Charts Configured</span>
                  <p className="text-xs text-[#9b9690] mt-1.5 leading-relaxed max-w-sm">
                    Configure live computed metric cards, target benchmarks, and dimensional distribution charts directly from your connected datasets.
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    {dataSources.length > 0 ? (
                      <button
                        onClick={() => setIsAddWidgetOpen(true)}
                        className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Create Your First KPI Metric</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Dataset First</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* KPI Cards Section */}
                {kpiCards.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono text-[#9b9690] uppercase font-semibold flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#e8a84c]" />
                        <span>Key Performance Indicators ({kpiCards.length})</span>
                      </h3>
                      <button
                        onClick={() => setIsAddWidgetOpen(true)}
                        className="text-xs text-[#e8a84c] hover:underline flex items-center gap-1 font-mono"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Metric</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {kpiCards.map((w) => (
                        <div
                          key={w.id || w.widget_id}
                          className="group relative bg-[#1a1918] hover:bg-[#1e1d1c] border border-[#2e2c2a] hover:border-[#3a3835] rounded-xl p-5 flex flex-col justify-between space-y-3 transition-all shadow-sm"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate">
                              <span className="font-semibold text-[#edeae4] text-xs truncate block" title={w.title}>
                                {w.title}
                              </span>
                              <span className="text-[10px] text-[#9b9690] font-mono mt-0.5 block truncate">
                                {w.data_source_name || 'Dataset'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteWidget(w.id || w.widget_id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[#5c5955] hover:text-[#e85c4c] rounded transition-all flex-shrink-0"
                              title="Delete KPI metric"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Value & Comparison */}
                          <div>
                            {w.error ? (
                              <div className="text-xs text-[#e85c4c] font-mono">{w.error}</div>
                            ) : (
                              <>
                                <div className="text-3xl font-bold font-mono text-[#edeae4] tracking-tight">
                                  {w.display_value || (w.value !== undefined ? String(w.value) : (w.value_formatted || w.computed_value || w.current_value || '0'))}
                                </div>

                                {w.comparison ? (
                                  <div className="flex items-center gap-1.5 text-xs font-mono mt-1.5">
                                    {w.comparison.direction === 'up' ? (
                                      <span className="text-[#5aab7f] flex items-center gap-0.5 font-semibold">
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                        {w.comparison.label}
                                      </span>
                                    ) : (
                                      <span className="text-[#e85c4c] flex items-center gap-0.5 font-semibold">
                                        <ArrowDownRight className="w-3.5 h-3.5" />
                                        {w.comparison.label}
                                      </span>
                                    )}
                                  </div>
                                ) : w.target_value ? (
                                  <div className="text-[11px] font-mono text-[#9b9690] mt-1.5">
                                    Target: {String(w.target_value)}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="text-[10px] font-mono text-[#5c5955] border-t border-[#2e2c2a] pt-2 flex items-center justify-between">
                            <span className="uppercase">{(w.metric_op || 'COUNT')} ({w.value_column || '*'})</span>
                            <span className="text-[#e8a84c] text-[9px] px-1.5 py-0.5 rounded bg-[#e8a84c]/10 border border-[#e8a84c]/20">
                              KPI
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts Section */}
                {chartWidgets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono text-[#9b9690] uppercase font-semibold flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-[#4c97e8]" />
                      <span>Distribution & Breakdown Charts ({chartWidgets.length})</span>
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {chartWidgets.map((w) => {
                        const isDonut = w.widget_type === 'donut_chart' || w.widget_type === 'pie_chart';
                        return (
                          <div
                            key={w.id || w.widget_id}
                            className="group relative bg-[#1a1918] hover:bg-[#1e1d1c] border border-[#2e2c2a] hover:border-[#3a3835] rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all shadow-sm"
                          >
                            {/* Chart Header */}
                            <div className="flex items-start justify-between gap-3 border-b border-[#2e2c2a] pb-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[#4c97e8]/10 border border-[#4c97e8]/30 flex items-center justify-center text-[#4c97e8] flex-shrink-0">
                                  {isDonut ? <PieChart className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-[#edeae4] text-xs leading-none">{w.title}</h4>
                                  <div className="text-[10px] text-[#9b9690] font-mono mt-1">
                                    {w.data_source_name} · Grouped by <span className="text-[#edeae4] font-medium">"{w.group_by_column}"</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] text-[#9b9690] border border-[#2e2c2a] uppercase">
                                  {w.widget_type === 'donut_chart' ? 'Donut' : 'Bar'}
                                </span>
                                <button
                                  onClick={() => handleDeleteWidget(w.id || w.widget_id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-[#5c5955] hover:text-[#e85c4c] rounded transition-all"
                                  title="Delete chart"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Total Summary */}
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-[#9b9690] font-mono text-[11px]">Total {w.metric_op?.toUpperCase() || 'COUNT'}:</span>
                              <span className="text-xl font-bold font-mono text-[#edeae4]">
                                {w.display_total || (w.total !== undefined ? String(w.total) : '0')}
                              </span>
                            </div>

                            {/* Series Progress Bars */}
                            <div className="space-y-2.5 pt-1">
                              {w.error ? (
                                <div className="text-xs text-[#e85c4c] font-mono">{w.error}</div>
                              ) : Array.isArray(w.series) && w.series.length > 0 ? (
                                w.series.map((s: any, idx: number) => (
                                  <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2 truncate pr-2">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: s.color }}
                                        />
                                        <span className="text-[#edeae4] text-[11px] truncate font-medium">
                                          {s.label}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#9b9690] flex-shrink-0">
                                        <span className="text-[#edeae4] font-semibold">{s.display_value}</span>
                                        <span>({s.percent}%)</span>
                                      </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-[#222120] rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${Math.min(100, Math.max(2, s.percent))}%`,
                                          backgroundColor: s.color,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-6 text-xs text-[#5c5955] font-mono">
                                  No breakdown series available for this grouping.
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="text-[10px] font-mono text-[#5c5955] border-t border-[#2e2c2a] pt-2 flex items-center justify-between">
                              <span>Aggregation: {(w.metric_op || 'COUNT').toUpperCase()}({w.value_column || '*'})</span>
                              <span>{Array.isArray(w.series) ? w.series.length : 0} series segments</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Advanced Analytics Workbench Tab */}
      {activeTab === 'analytics' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#161514] border border-[#2e2c2a] rounded-xl p-5 overflow-hidden">
          <AdvancedAnalyticsWorkbench
            activeSource={activeSource}
            columns={parsedColumns}
          />
        </div>
      )}

      {/* Delete Dataset Confirmation Modal */}
      <DeleteDatasetModal
        isOpen={Boolean(deleteConfirmSource)}
        dataset={deleteConfirmSource}
        loading={deletingSource}
        onClose={() => setDeleteConfirmSource(null)}
        onConfirm={handleConfirmDeleteSource}
      />

      {/* Add KPI Metric / Chart Modal */}
      <AddWidgetModal
        isOpen={isAddWidgetOpen}
        dataSources={dataSources}
        initialSourceId={selectedSourceId}
        dashboardId={activeDashboardId}
        onClose={() => setIsAddWidgetOpen(false)}
        onCreated={() => loadDashboardWidgets()}
      />
    </div>
  );
};

export default StudioView;
