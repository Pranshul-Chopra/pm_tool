import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Table,
  Sparkles,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  Zap,
  BarChart3,
  Percent,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import AppBridge from '../../services/bridge';
import type { DataSource } from '../../types';

interface AdvancedAnalyticsWorkbenchProps {
  activeSource?: DataSource | null;
  columns: { name: string; type: string }[];
}

type AnalyticsSubTab = 'funnel' | 'retention' | 'statistics' | 'correlation' | 'forecast';

export const AdvancedAnalyticsWorkbench: React.FC<AdvancedAnalyticsWorkbenchProps> = ({
  activeSource,
  columns,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>('funnel');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Funnel State
  const [funnelStageCol, setFunnelStageCol] = useState<string>('');
  const [funnelStagesInput, setFunnelStagesInput] = useState<string>('visit, signup, active, paid');
  const [funnelEntityCol, setFunnelEntityCol] = useState<string>('');
  const [funnelResult, setFunnelResult] = useState<any | null>(null);

  // 2. Cohort Retention State
  const [retentionUserCol, setRetentionUserCol] = useState<string>('');
  const [retentionDateCol, setRetentionDateCol] = useState<string>('');
  const [retentionPeriodType, setRetentionPeriodType] = useState<string>('month');
  const [retentionMaxPeriods, setRetentionMaxPeriods] = useState<number>(6);
  const [retentionResult, setRetentionResult] = useState<any | null>(null);

  // 3. Distribution & Outliers State
  const [statsCol, setStatsCol] = useState<string>('');
  const [statsResult, setStatsResult] = useState<any | null>(null);

  // 4. Correlation Matrix State
  const [correlationResult, setCorrelationResult] = useState<any | null>(null);

  // 5. Trendline Forecast State
  const [forecastDateCol, setForecastDateCol] = useState<string>('');
  const [forecastMetricCol, setForecastMetricCol] = useState<string>('');
  const [forecastPeriodsAhead, setForecastPeriodsAhead] = useState<number>(5);
  const [forecastAggregation, setForecastAggregation] = useState<string>('sum');
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  // Auto-select initial column candidates
  useEffect(() => {
    if (columns && columns.length > 0) {
      const colNames = columns.map((c) => c.name);
      if (!funnelStageCol) {
        const candidate = colNames.find((n) => /stage|event|status|step|funnel/i.test(n)) || colNames[0];
        setFunnelStageCol(candidate);
      }
      if (!funnelEntityCol) {
        const candidate = colNames.find((n) => /user|id|account|customer|client/i.test(n)) || '';
        setFunnelEntityCol(candidate);
      }
      if (!retentionUserCol) {
        const candidate = colNames.find((n) => /user|id|account|customer/i.test(n)) || colNames[0];
        setRetentionUserCol(candidate);
      }
      if (!retentionDateCol) {
        const candidate = colNames.find((n) => /date|time|created|timestamp|day|month/i.test(n)) || colNames[0];
        setRetentionDateCol(candidate);
      }
      if (!statsCol) {
        const candidate = colNames.find((n) => /amount|revenue|price|score|val|cost|count/i.test(n)) || colNames[0];
        setStatsCol(candidate);
      }
      if (!forecastDateCol) {
        const candidate = colNames.find((n) => /date|time|created|day/i.test(n)) || colNames[0];
        setForecastDateCol(candidate);
      }
      if (!forecastMetricCol) {
        const candidate = colNames.find((n) => /amount|revenue|price|total|sales|count/i.test(n)) || colNames[0];
        setForecastMetricCol(candidate);
      }
    }
  }, [columns]);

  if (!activeSource) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#9b9690] space-y-3">
        <Layers className="w-10 h-10 text-[#5c5955]" />
        <p className="text-sm">Select or upload a dataset to run advanced analytical models.</p>
      </div>
    );
  }

  // ── Run Handlers ──────────────────────────────────────────────────────────

  const handleRunFunnel = async () => {
    if (!funnelStageCol) {
      setError('Please select a stage/event column.');
      return;
    }
    const stages = funnelStagesInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (stages.length < 2) {
      setError('Please provide at least 2 comma-separated funnel stages.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getFunnelAnalysis({
        source_id: activeSource.id,
        stage_column: funnelStageCol,
        stages: stages,
        entity_column: funnelEntityCol.trim() || undefined,
      });
      if (res && res.success) {
        setFunnelResult(res);
      } else {
        setError(res?.error || 'Failed to compute funnel.');
      }
    } catch (err: any) {
      setError(err.message || 'Funnel computation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunRetention = async () => {
    if (!retentionUserCol || !retentionDateCol) {
      setError('Please select both a User ID and Date column.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getCohortRetention({
        source_id: activeSource.id,
        user_column: retentionUserCol,
        date_column: retentionDateCol,
        period_type: retentionPeriodType,
        max_periods: retentionMaxPeriods,
      });
      if (res && res.success) {
        setRetentionResult(res);
      } else {
        setError(res?.error || 'Failed to compute retention matrix.');
      }
    } catch (err: any) {
      setError(err.message || 'Retention computation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunStatistics = async () => {
    if (!statsCol) {
      setError('Please select a column to evaluate distributions.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getColumnStatistics({
        source_id: activeSource.id,
        column_name: statsCol,
      });
      if (res && res.success) {
        setStatsResult(res);
      } else {
        setError(res?.error || 'Failed to analyze distribution.');
      }
    } catch (err: any) {
      setError(err.message || 'Distribution calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunCorrelation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getCorrelationMatrix({
        source_id: activeSource.id,
      });
      if (res && res.success) {
        setCorrelationResult(res);
      } else {
        setError(res?.error || 'Failed to compute correlations.');
      }
    } catch (err: any) {
      setError(err.message || 'Correlation computation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunForecast = async () => {
    if (!forecastDateCol || !forecastMetricCol) {
      setError('Please select both a date and numeric metric column.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await AppBridge.api.getTrendForecast({
        source_id: activeSource.id,
        date_column: forecastDateCol,
        metric_column: forecastMetricCol,
        periods_ahead: forecastPeriodsAhead,
        aggregation: forecastAggregation,
      });
      if (res && res.success) {
        setForecastResult(res);
      } else {
        setError(res?.error || 'Failed to project trajectory.');
      }
    } catch (err: any) {
      setError(err.message || 'Forecast computation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-4">
      {/* Sub-Nav Model Selector */}
      <div className="flex items-center justify-between border-b border-[#2e2c2a] pb-3 flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-[#1a1918] p-1 rounded-xl border border-[#2e2c2a]">
          <button
            type="button"
            onClick={() => { setActiveSubTab('funnel'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'funnel'
                ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                : 'text-[#9b9690] hover:text-[#edeae4]'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Funnel Analyzer</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('retention'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'retention'
                ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                : 'text-[#9b9690] hover:text-[#edeae4]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Cohort Retention</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('statistics'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'statistics'
                ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                : 'text-[#9b9690] hover:text-[#edeae4]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Distributions & Outliers</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('correlation'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'correlation'
                ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                : 'text-[#9b9690] hover:text-[#edeae4]'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Correlation Grid</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('forecast'); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeSubTab === 'forecast'
                ? 'bg-[#222120] text-[#e8a84c] shadow-sm font-semibold'
                : 'text-[#9b9690] hover:text-[#edeae4]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Trend Forecasting</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#9b9690]">
          <span className="font-mono text-[#e8a84c]">{activeSource.name}</span>
          <span className="text-[#5c5955]">({activeSource.row_count} rows)</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-xl bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-xs flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* ── 1. FUNNEL ANALYZER ────────────────────────────────────────────── */}
        {activeSubTab === 'funnel' && (
          <div className="space-y-4">
            {/* Config Card */}
            <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Stage / Event Column
                  </label>
                  <select
                    value={funnelStageCol}
                    onChange={(e) => setFunnelStageCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Entity ID Column (Optional)
                  </label>
                  <select
                    value={funnelEntityCol}
                    onChange={(e) => setFunnelEntityCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value="">Count Total Rows</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        Distinct {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Ordered Funnel Stages (Comma-Separated)
                  </label>
                  <input
                    type="text"
                    value={funnelStagesInput}
                    onChange={(e) => setFunnelStagesInput(e.target.value)}
                    placeholder="e.g. visit, signup, active, paid"
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRunFunnel}
                  disabled={loading}
                  className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>Compute Funnel Drop-Off</span>
                </button>
              </div>
            </div>

            {/* Results */}
            {funnelResult && (
              <div className="space-y-4">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Top Volume</span>
                    <p className="text-lg font-bold text-[#edeae4] mt-0.5">
                      {funnelResult.total_top_conversions.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Final Step</span>
                    <p className="text-lg font-bold text-[#5aab7f] mt-0.5">
                      {funnelResult.final_step_conversions.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Overall Conversion</span>
                    <p className="text-lg font-bold text-[#e8a84c] mt-0.5">
                      {funnelResult.overall_conversion_rate}%
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Total Stages</span>
                    <p className="text-lg font-bold text-[#4c97e8] mt-0.5">
                      {funnelResult.steps.length}
                    </p>
                  </div>
                </div>

                {/* Funnel Visual Bars */}
                <div className="p-5 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3.5">
                  <h4 className="text-xs font-semibold text-[#edeae4] flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-[#e8a84c]" />
                    <span>Conversion Pipeline & Step-by-Step Drop-Off</span>
                  </h4>

                  <div className="space-y-3 pt-2">
                    {funnelResult.steps.map((step: any, idx: number) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] w-5 h-5 rounded-full bg-[#222120] text-[#9b9690] flex items-center justify-center border border-[#2e2c2a]">
                              {step.step_order}
                            </span>
                            <span className="font-semibold text-[#edeae4]">{step.stage}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[#edeae4] font-medium">
                              {step.count.toLocaleString()}
                            </span>
                            <span className="text-[11px] font-mono text-[#e8a84c]">
                              {step.conversion_from_top}% of top
                            </span>
                            {idx > 0 && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  step.drop_off_rate > 50
                                    ? 'bg-[#e85c4c]/15 text-[#e85c4c]'
                                    : 'bg-[#9b9690]/15 text-[#9b9690]'
                                }`}
                              >
                                -{step.drop_off_rate}% drop ({step.drop_off_count.toLocaleString()})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bar */}
                        <div className="w-full bg-[#111110] rounded-full h-3.5 overflow-hidden border border-[#2e2c2a]">
                          <div
                            className="h-full bg-gradient-to-r from-[#e8a84c] to-[#5aab7f] transition-all duration-500 rounded-full"
                            style={{ width: `${Math.max(2, step.conversion_from_top)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. COHORT RETENTION ───────────────────────────────────────────── */}
        {activeSubTab === 'retention' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    User / Entity Column
                  </label>
                  <select
                    value={retentionUserCol}
                    onChange={(e) => setRetentionUserCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Date / Timestamp Column
                  </label>
                  <select
                    value={retentionDateCol}
                    onChange={(e) => setRetentionDateCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Interval Frequency
                  </label>
                  <select
                    value={retentionPeriodType}
                    onChange={(e) => setRetentionPeriodType(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value="month">Month-over-Month (MoM)</option>
                    <option value="week">Week-over-Week (WoW)</option>
                    <option value="day">Day-over-Day (DoD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Max Periods
                  </label>
                  <select
                    value={retentionMaxPeriods}
                    onChange={(e) => setRetentionMaxPeriods(Number(e.target.value))}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value={4}>4 Periods</option>
                    <option value={6}>6 Periods</option>
                    <option value={8}>8 Periods</option>
                    <option value={12}>12 Periods</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRunRetention}
                  disabled={loading}
                  className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  <span>Generate Retention Matrix</span>
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            {retentionResult && (
              <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3 overflow-x-auto">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#edeae4] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#e8a84c]" />
                    <span>Cohort Retention Heatmap Matrix ({retentionResult.total_cohorts} cohorts)</span>
                  </h4>
                  <span className="text-[10px] text-[#9b9690] font-mono">
                    Computed in {retentionResult.duration_ms}ms
                  </span>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#2e2c2a] text-[#9b9690] text-[11px]">
                      <th className="py-2 px-3">Cohort</th>
                      <th className="py-2 px-3">Users</th>
                      {retentionResult.period_headers.map((h: string, i: number) => (
                        <th key={i} className="py-2 px-3 text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {retentionResult.cohorts.map((cohort: any, rowIdx: number) => (
                      <tr key={rowIdx} className="border-b border-[#222120] hover:bg-[#1a1918]">
                        <td className="py-2 px-3 font-mono font-medium text-[#edeae4] whitespace-nowrap">
                          {cohort.cohort}
                        </td>
                        <td className="py-2 px-3 font-mono text-[#9b9690]">
                          {cohort.cohort_size.toLocaleString()}
                        </td>
                        {cohort.retention.map((pct: number | null, colIdx: number) => {
                          if (pct === null) {
                            return (
                              <td key={colIdx} className="py-2 px-3 text-center text-[#423f3b]">
                                —
                              </td>
                            );
                          }
                          // Color intensity based on percentage
                          const bgIntensity =
                            pct >= 70
                              ? 'bg-[#5aab7f]/25 text-[#5aab7f] font-semibold'
                              : pct >= 40
                              ? 'bg-[#e8a84c]/20 text-[#e8a84c] font-medium'
                              : pct >= 20
                              ? 'bg-[#4c97e8]/15 text-[#4c97e8]'
                              : 'bg-[#222120] text-[#9b9690]';

                          return (
                            <td key={colIdx} className="py-2 px-2 text-center">
                              <span className={`inline-block w-12 py-1 rounded text-[11px] font-mono ${bgIntensity}`}>
                                {pct}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 3. DISTRIBUTIONS & OUTLIERS ───────────────────────────────────── */}
        {activeSubTab === 'statistics' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] flex items-end justify-between gap-3 flex-wrap">
              <div className="w-full sm:w-72">
                <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                  Target Numerical Column
                </label>
                <select
                  value={statsCol}
                  onChange={(e) => setStatsCol(e.target.value)}
                  className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunStatistics}
                disabled={loading}
                className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                <span>Analyze Distribution & Outliers</span>
              </button>
            </div>

            {statsResult && (
              <div className="space-y-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Count</span>
                    <p className="text-base font-bold text-[#edeae4] mt-0.5">{statsResult.count.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Mean</span>
                    <p className="text-base font-bold text-[#e8a84c] mt-0.5">{statsResult.mean.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Median (P50)</span>
                    <p className="text-base font-bold text-[#edeae4] mt-0.5">{statsResult.median.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Std Deviation</span>
                    <p className="text-base font-bold text-[#4c97e8] mt-0.5">±{statsResult.std_dev.toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Min / Max</span>
                    <p className="text-xs font-mono text-[#edeae4] mt-1 truncate">
                      {statsResult.min} ... {statsResult.max}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Outliers Flagged</span>
                    <p className="text-base font-bold text-[#e85c4c] mt-0.5">
                      {statsResult.outlier_count} ({statsResult.outlier_percentage}%)
                    </p>
                  </div>
                </div>

                {/* Percentiles & Fences */}
                <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3">
                  <h4 className="text-xs font-semibold text-[#edeae4]">
                    Quantiles & Tukey's Fences ({statsResult.column})
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
                      <span className="text-[10px] text-[#9b9690] block">P25 (Q1)</span>
                      <span className="text-[#edeae4] font-semibold">{statsResult.p25}</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
                      <span className="text-[10px] text-[#9b9690] block">P50 (Median)</span>
                      <span className="text-[#e8a84c] font-semibold">{statsResult.median}</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
                      <span className="text-[10px] text-[#9b9690] block">P75 (Q3)</span>
                      <span className="text-[#edeae4] font-semibold">{statsResult.p75}</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
                      <span className="text-[10px] text-[#9b9690] block">P90</span>
                      <span className="text-[#edeae4] font-semibold">{statsResult.p90}</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
                      <span className="text-[10px] text-[#9b9690] block">P99</span>
                      <span className="text-[#edeae4] font-semibold">{statsResult.p99}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#9b9690] pt-2 border-t border-[#222120] font-mono">
                    <span>IQR: <b className="text-[#edeae4]">{statsResult.iqr}</b></span>
                    <span>Lower Fence: <b className="text-[#edeae4]">{statsResult.lower_fence}</b></span>
                    <span>Upper Fence: <b className="text-[#edeae4]">{statsResult.upper_fence}</b></span>
                  </div>
                </div>

                {/* Sample Outliers Table */}
                {statsResult.sample_outliers && statsResult.sample_outliers.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#e85c4c]">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Flagged Outlier Records (Tukey 1.5×IQR / |Z| &gt; 3.0)</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-[#2e2c2a] text-[#9b9690] text-[11px]">
                            <th className="py-1 px-2">Row ID</th>
                            <th className="py-1 px-2">Value</th>
                            <th className="py-1 px-2">Z-Score</th>
                            <th className="py-1 px-2">Outlier Direction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statsResult.sample_outliers.map((out: any, i: number) => (
                            <tr key={i} className="border-b border-[#222120] hover:bg-[#1a1918]">
                              <td className="py-1 px-2 text-[#9b9690]">#{out.row_id}</td>
                              <td className="py-1 px-2 text-[#edeae4] font-semibold">{out.value}</td>
                              <td className="py-1 px-2 text-[#e8a84c]">{out.z_score}</td>
                              <td className="py-1 px-2 uppercase text-[10px] text-[#e85c4c]">
                                {out.outlier_type} Outlier
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 4. CORRELATION GRID ───────────────────────────────────────────── */}
        {activeSubTab === 'correlation' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-[#edeae4]">
                  Pairwise Feature Correlation Matrix
                </h4>
                <p className="text-[11px] text-[#9b9690] mt-0.5">
                  Calculates Pearson correlation coefficients r ∈ [-1.0, 1.0] across numeric dataset features.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunCorrelation}
                disabled={loading}
                className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table className="w-3.5 h-3.5" />}
                <span>Compute Correlation Grid</span>
              </button>
            </div>

            {correlationResult && (
              <div className="space-y-4">
                {/* Heatmap Grid */}
                <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-[11px] text-[#9b9690]">Feature</th>
                        {correlationResult.columns.map((c: string, idx: number) => (
                          <th key={idx} className="p-2 text-center text-[10px] font-mono text-[#9b9690] w-20 truncate">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlationResult.columns.map((rCol: string, rIdx: number) => (
                        <tr key={rIdx}>
                          <td className="p-2 font-mono text-[11px] text-[#edeae4] font-medium whitespace-nowrap">
                            {rCol}
                          </td>
                          {correlationResult.matrix[rIdx].map((val: number, cIdx: number) => {
                            const isSelf = rIdx === cIdx;
                            const isPos = val > 0;
                            const isNeg = val < 0;
                            const absVal = Math.abs(val);

                            let cellBg = 'bg-[#1a1918] text-[#9b9690]';
                            if (isSelf) {
                              cellBg = 'bg-[#222120] text-[#edeae4] font-semibold';
                            } else if (isPos && absVal >= 0.6) {
                              cellBg = 'bg-[#4c97e8]/25 text-[#4c97e8] font-bold';
                            } else if (isPos && absVal >= 0.3) {
                              cellBg = 'bg-[#4c97e8]/15 text-[#4c97e8]';
                            } else if (isNeg && absVal >= 0.6) {
                              cellBg = 'bg-[#e85c4c]/25 text-[#e85c4c] font-bold';
                            } else if (isNeg && absVal >= 0.3) {
                              cellBg = 'bg-[#e85c4c]/15 text-[#e85c4c]';
                            }

                            return (
                              <td key={cIdx} className="p-1 text-center">
                                <span className={`inline-block w-16 py-1 rounded text-[11px] font-mono ${cellBg}`}>
                                  {val.toFixed(2)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Top Pairs List */}
                {correlationResult.top_pairs && correlationResult.top_pairs.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-2">
                    <h5 className="text-xs font-semibold text-[#edeae4]">
                      Key Feature Correlations
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {correlationResult.top_pairs.slice(0, 6).map((pair: any, i: number) => (
                        <div key={i} className="p-2.5 rounded bg-[#1a1918] border border-[#2e2c2a] flex items-center justify-between">
                          <span className="font-mono text-[#edeae4]">
                            {pair.col1} ↔ {pair.col2}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#9b9690]">{pair.relationship}</span>
                            <span
                              className={`font-mono font-semibold ${
                                pair.correlation > 0 ? 'text-[#4c97e8]' : 'text-[#e85c4c]'
                              }`}
                            >
                              {pair.correlation > 0 ? `+${pair.correlation}` : pair.correlation}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 5. TREND FORECASTING ─────────────────────────────────────────── */}
        {activeSubTab === 'forecast' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Date / Time Column
                  </label>
                  <select
                    value={forecastDateCol}
                    onChange={(e) => setForecastDateCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Metric Column
                  </label>
                  <select
                    value={forecastMetricCol}
                    onChange={(e) => setForecastMetricCol(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Aggregation Mode
                  </label>
                  <select
                    value={forecastAggregation}
                    onChange={(e) => setForecastAggregation(e.target.value)}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value="sum">SUM (Total Volume)</option>
                    <option value="avg">AVG (Mean Rate)</option>
                    <option value="count">COUNT (Frequency)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9b9690] mb-1">
                    Periods Ahead
                  </label>
                  <select
                    value={forecastPeriodsAhead}
                    onChange={(e) => setForecastPeriodsAhead(Number(e.target.value))}
                    className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-2.5 py-1.5 text-xs text-[#edeae4] focus:outline-none"
                  >
                    <option value={3}>3 Periods</option>
                    <option value={5}>5 Periods</option>
                    <option value={8}>8 Periods</option>
                    <option value={12}>12 Periods</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRunForecast}
                  disabled={loading}
                  className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  <span>Project Trajectory & Forecast</span>
                </button>
              </div>
            </div>

            {/* Forecast Output */}
            {forecastResult && (
              <div className="space-y-4">
                {/* Stats Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Trend Trajectory</span>
                    <p
                      className={`text-base font-bold mt-0.5 ${
                        forecastResult.trend_slope > 0
                          ? 'text-[#5aab7f]'
                          : forecastResult.trend_slope < 0
                          ? 'text-[#e85c4c]'
                          : 'text-[#9b9690]'
                      }`}
                    >
                      {forecastResult.trend_direction} ({forecastResult.trend_slope > 0 ? '+' : ''}{forecastResult.trend_slope}/period)
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Goodness of Fit (R²)</span>
                    <p className="text-base font-bold text-[#e8a84c] mt-0.5">
                      {forecastResult.r_squared}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Historical Points</span>
                    <p className="text-base font-bold text-[#edeae4] mt-0.5">
                      {forecastResult.historical.length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#1a1918] border border-[#2e2c2a]">
                    <span className="text-[10px] text-[#9b9690] uppercase font-mono">Projected Ahead</span>
                    <p className="text-base font-bold text-[#4c97e8] mt-0.5">
                      {forecastResult.forecast.length} Periods
                    </p>
                  </div>
                </div>

                {/* Forecast Table / Series */}
                <div className="p-4 rounded-xl bg-[#161514] border border-[#2e2c2a] space-y-3">
                  <h4 className="text-xs font-semibold text-[#edeae4] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#e8a84c]" />
                    <span>Projected Future Milestones</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {forecastResult.forecast.map((f: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-[#1a1918] border border-[#2e2c2a]">
                        <span className="text-[10px] text-[#9b9690] font-mono">{f.label}</span>
                        <p className="text-base font-bold text-[#e8a84c] font-mono mt-0.5">
                          {f.forecasted_value.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedAnalyticsWorkbench;
