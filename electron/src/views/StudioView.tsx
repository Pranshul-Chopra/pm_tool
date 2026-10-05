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
} from 'lucide-react';
import type { DataSource, KPIWidget } from '../types';
import AppBridge from '../services/bridge';

export const StudioView: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'sandbox' | 'dashboard'
  const [activeTab, setActiveTab] = useState<'sandbox' | 'dashboard'>('sandbox');

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

  const fetchStudioData = async () => {
    setLoading(true);
    try {
      const dsRes = await AppBridge.api.getDataSources();
      const sources = dsRes.data_sources || [];
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
      const dashboards = res.dashboards || [];
      if (dashboards.length > 0) {
        const detail = await AppBridge.api.getDashboardDetail(dashboards[0].id);
        setWidgets(detail.widgets || []);
      } else {
        // Fallback to general widgets
        const wRes = await AppBridge.api.getWidgets();
        setWidgets(wRes.widgets || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard widgets:', err);
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
      if (res.success) {
        setUploadStatus({
          type: 'success',
          message: `Dataset "${file.name}" materialized with ${res.data_source?.row_count || 0} rows.`,
        });
        fetchStudioData();
      } else {
        setUploadStatus({ type: 'error', message: 'Ingestion failed.' });
      }
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Failed to ingest file.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSource = async (sourceId: number, name: string) => {
    if (!window.confirm(`Delete dataset "${name}" and drop its materialized table?`)) return;

    try {
      await AppBridge.api.deleteDataSource(sourceId);
      setDataSources((prev) => prev.filter((s) => s.id !== sourceId));
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(null);
        setQueryResult(null);
      }
    } catch (err: any) {
      alert(`Failed to delete dataset: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    if (!queryResult || !queryResult.columns || !queryResult.rows) return;
    const headers = queryResult.columns.join(',');
    const rows = queryResult.rows
      .map((r: any[]) => r.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
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
  if (activeSource?.columns_json) {
    try {
      parsedColumns = JSON.parse(activeSource.columns_json);
    } catch (_) {}
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
            Materialize CSV/Excel sheets into analytical SQLite tables and query securely with read-only sandbox checks.
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
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".csv,.xlsx,.xls,.tsv,.json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
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
              {dataSources.map((ds) => (
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
                      {ds.row_count} rows · {ds.column_count} cols · {ds.file_type}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSource(ds.id, ds.name);
                    }}
                    className="p-1 text-[#5c5955] hover:text-[#e85c4c] rounded"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {dataSources.length === 0 && !loading && (
                <div className="text-center py-8 text-xs text-[#5c5955] p-4">
                  No datasets uploaded. Ingest an Excel or CSV file to start analyzing.
                </div>
              )}
            </div>

            {/* Schema Column Pills */}
            {parsedColumns.length > 0 && (
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
                {queryResult && queryResult.columns ? (
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
                      {queryResult.rows.map((row: any[], rIdx: number) => (
                        <tr
                          key={rIdx}
                          className="border-b border-[#222120] hover:bg-[#222120]/60 font-mono text-[11px]"
                        >
                          {row.map((cell: any, cIdx: number) => (
                            <td key={cIdx} className="p-2.5 text-[#edeae4]">
                              {cell !== null && cell !== undefined ? String(cell) : 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
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
        <div className="flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map((w) => (
              <div
                key={w.id}
                className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-[#9b9690]">
                  <span className="font-semibold text-[#edeae4] truncate">{w.title}</span>
                  <span className="font-mono text-[10px] text-[#e8a84c] uppercase">
                    {w.operation || 'METRIC'}
                  </span>
                </div>

                <div>
                  <div className="text-3xl font-bold font-mono text-[#edeae4]">
                    {w.value_formatted || w.computed_value || w.current_value || '0'}
                  </div>

                  {w.target_value && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1 text-[#9b9690]">
                      <span>Target: {w.target_value}</span>
                      {w.direction && (
                        <span
                          className={`font-bold ${
                            w.direction === 'up' ? 'text-[#5aab7f]' : 'text-[#e85c4c]'
                          }`}
                        >
                          ({w.diff_pct || '0%'})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[10px] font-mono text-[#5c5955] border-t border-[#2e2c2a] pt-2">
                  Column: {w.target_column || 'dataset'}
                </div>
              </div>
            ))}

            {widgets.length === 0 && !loadingWidgets && (
              <div className="col-span-full py-12 text-center text-xs text-[#5c5955] bg-[#1a1918] border border-dashed border-[#2e2c2a] rounded-xl p-6">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#e8a84c]" />
                <span className="font-semibold text-[#edeae4]">No KPI metrics created yet</span>
                <p className="text-[11px] text-[#9b9690] mt-1">
                  Connect datasets in SQL Sandbox to configure dynamic KPI cards and benchmarks.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioView;
