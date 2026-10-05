import React, { useEffect, useState } from 'react';
import { Database, Play, Clock, Table, AlertCircle } from 'lucide-react';
import type { DataSource, KPIWidget } from '../types';
import AppBridge from '../services/bridge';

export const StudioView: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [widgets, setWidgets] = useState<KPIWidget[]>([]);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM data LIMIT 20;');
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudio() {
      try {
        const [dsRes, wRes] = await Promise.all([
          AppBridge.api.getDataSources(),
          AppBridge.api.getWidgets(),
        ]);
        setDataSources(dsRes.data_sources || []);
        setWidgets(wRes.widgets || []);
        if (dsRes.data_sources && dsRes.data_sources.length > 0) {
          setSelectedSource(dsRes.data_sources[0].id);
        }
      } catch (err) {
        console.error('Failed to load studio data:', err);
      }
    }
    loadStudio();
  }, []);

  const handleRunQuery = async () => {
    if (!selectedSource) return;
    setLoadingQuery(true);
    setQueryError(null);
    try {
      const res = await AppBridge.api.executeSafeSQL(selectedSource, sqlQuery);
      setQueryResult(res);
    } catch (err: any) {
      setQueryError(err.message || 'Execution error');
      setQueryResult(null);
    } finally {
      setLoadingQuery(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">Data Studio & Safe SQL Sandbox</h2>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Guarded AST-checked analytical sandbox with SQLite in-memory and disk datasets.
          </p>
        </div>

        {dataSources.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9b9690]">Active Dataset:</span>
            <select
              value={selectedSource || ''}
              onChange={(e) => setSelectedSource(Number(e.target.value))}
              className="bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1 text-xs text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
            >
              {dataSources.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.row_count} rows)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SQL Editor Area */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-[#e8a84c] flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5" />
            <span>SQL Sandbox (Read-Only Guarded)</span>
          </span>

          <button
            onClick={handleRunQuery}
            disabled={loadingQuery || !selectedSource}
            className="px-3 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Play className={`w-3.5 h-3.5 ${loadingQuery ? 'animate-spin' : ''}`} />
            <span>Execute Query</span>
          </button>
        </div>

        <textarea
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          rows={3}
          className="w-full bg-[#111110] border border-[#2e2c2a] rounded-lg p-3 font-mono text-xs text-[#edeae4] focus:outline-none focus:border-[#e8a84c] resize-none"
          placeholder="SELECT * FROM data LIMIT 20;"
        />
      </div>

      {queryError && (
        <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{queryError}</span>
        </div>
      )}

      {/* Query Results Table */}
      <div className="flex-1 bg-[#1a1918] border border-[#2e2c2a] rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between text-xs text-[#9b9690] flex-shrink-0">
          <span>Results Preview</span>
          {queryResult && (
            <span className="font-mono text-[11px] text-[#5aab7f]">
              {queryResult.row_count} rows in {queryResult.execution_time_ms}ms
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {queryResult && queryResult.columns ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2e2c2a] text-[#9b9690] text-left">
                  {queryResult.columns.map((col: string, idx: number) => (
                    <th key={idx} className="p-2 font-mono font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.rows.map((row: any[], rIdx: number) => (
                  <tr key={rIdx} className="border-b border-[#222120] hover:bg-[#222120]/50 font-mono text-[11px]">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="p-2 text-[#edeae4]">
                        {cell !== null && cell !== undefined ? String(cell) : 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-[#5c5955]">
              <Database className="w-8 h-8 mb-2 opacity-50" />
              <span>Run a query to inspect dataset records and schemas</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioView;
