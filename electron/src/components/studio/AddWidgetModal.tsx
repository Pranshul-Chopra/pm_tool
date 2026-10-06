import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  BarChart3,
  PieChart,
  Sparkles,
  Layers,
  CheckCircle,
} from 'lucide-react';
import type { DataSource } from '../../types';
import AppBridge from '../../services/bridge';

interface AddWidgetModalProps {
  isOpen: boolean;
  dataSources: DataSource[];
  initialSourceId: number | null;
  dashboardId: number | null;
  onClose: () => void;
  onCreated: () => void;
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  dataSources,
  initialSourceId,
  dashboardId,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [widgetType, setWidgetType] = useState<'kpi_card' | 'bar_chart' | 'donut_chart'>('kpi_card');
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(initialSourceId);
  const [metricOp, setMetricOp] = useState<'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'>('COUNT');
  const [valueColumn, setValueColumn] = useState('');
  const [groupByColumn, setGroupByColumn] = useState('');
  const [formatType, setFormatType] = useState('number');
  const [targetValue, setTargetValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSourceId) {
      setSelectedSourceId(initialSourceId);
    } else if (dataSources.length > 0) {
      setSelectedSourceId(dataSources[0].id);
    }
  }, [initialSourceId, dataSources]);

  // Find columns of the selected dataset
  const currentSource = dataSources.find((s) => s.id === selectedSourceId);
  const columns: { name: string; type: string }[] = React.useMemo(() => {
    if (!currentSource) return [];
    const raw = currentSource.columns_json || (currentSource as any)?.schema_json;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [currentSource]);

  // When columns change, set default columns
  useEffect(() => {
    if (columns.length > 0) {
      if (!valueColumn || !columns.some((c) => c.name === valueColumn)) {
        setValueColumn(columns[0].name);
      }
      if (!groupByColumn || !columns.some((c) => c.name === groupByColumn)) {
        // Pick second column or first for dimension
        setGroupByColumn(columns.length > 1 ? columns[1].name : columns[0].name);
      }
    }
  }, [columns]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a metric title.');
      return;
    }
    if (!selectedSourceId) {
      setError('Please select a target dataset.');
      return;
    }
    if (!dashboardId) {
      setError('No target dashboard available.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        data_source_id: selectedSourceId,
        widget_type: widgetType,
        metric_op: metricOp.toLowerCase(),
        value_column: valueColumn,
        format_type: formatType,
      };

      if (widgetType !== 'kpi_card') {
        payload.group_by_column = groupByColumn;
      }

      if (targetValue.trim() !== '' && !isNaN(Number(targetValue))) {
        payload.target_value = Number(targetValue);
      }

      await AppBridge.api.createWidget(dashboardId, payload);
      onCreated();
      onClose();
      // Reset form
      setTitle('');
      setTargetValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to create widget.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2e2c2a] flex items-center justify-between bg-[#161514]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#e8a84c]/10 border border-[#e8a84c]/30 flex items-center justify-center text-[#e8a84c]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#edeae4]">Add KPI Metric or Chart</h3>
              <p className="text-[11px] text-[#9b9690]">
                Configure live computed metrics from your connected datasets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-[#e85c4c]/10 border border-[#e85c4c]/30 text-[#e85c4c] text-[11px]">
              {error}
            </div>
          )}

          {/* Widget Type Selector */}
          <div>
            <label className="block text-[11px] font-mono text-[#9b9690] mb-2 font-semibold uppercase">
              Widget Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setWidgetType('kpi_card')}
                className={`p-3 rounded-lg border text-left flex flex-col items-center gap-1.5 transition-all ${
                  widgetType === 'kpi_card'
                    ? 'bg-[#222120] border-[#e8a84c] text-[#e8a84c] shadow-sm'
                    : 'bg-[#161514] border-[#2e2c2a] text-[#9b9690] hover:border-[#3a3835]'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span className="font-semibold text-[11px]">KPI Card</span>
              </button>

              <button
                type="button"
                onClick={() => setWidgetType('bar_chart')}
                className={`p-3 rounded-lg border text-left flex flex-col items-center gap-1.5 transition-all ${
                  widgetType === 'bar_chart'
                    ? 'bg-[#222120] border-[#e8a84c] text-[#e8a84c] shadow-sm'
                    : 'bg-[#161514] border-[#2e2c2a] text-[#9b9690] hover:border-[#3a3835]'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-semibold text-[11px]">Bar Chart</span>
              </button>

              <button
                type="button"
                onClick={() => setWidgetType('donut_chart')}
                className={`p-3 rounded-lg border text-left flex flex-col items-center gap-1.5 transition-all ${
                  widgetType === 'donut_chart'
                    ? 'bg-[#222120] border-[#e8a84c] text-[#e8a84c] shadow-sm'
                    : 'bg-[#161514] border-[#2e2c2a] text-[#9b9690] hover:border-[#3a3835]'
                }`}
              >
                <PieChart className="w-5 h-5" />
                <span className="font-semibold text-[11px]">Donut Chart</span>
              </button>
            </div>
          </div>

          {/* Metric Title */}
          <div>
            <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
              METRIC TITLE <span className="text-[#e85c4c]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Total Revenue, Average Order Quantity, Stock by Product"
              className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c] font-medium"
              required
            />
          </div>

          {/* Target Dataset & Aggregation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
                SOURCE DATASET
              </label>
              <select
                value={selectedSourceId || ''}
                onChange={(e) => setSelectedSourceId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
              >
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.row_count} rows)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
                AGGREGATION OP
              </label>
              <select
                value={metricOp}
                onChange={(e) => setMetricOp(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
              >
                <option value="COUNT">COUNT (Total Rows)</option>
                <option value="SUM">SUM (Sum Column)</option>
                <option value="AVG">AVG (Average)</option>
                <option value="MIN">MIN (Minimum)</option>
                <option value="MAX">MAX (Maximum)</option>
              </select>
            </div>
          </div>

          {/* Value Column & Group By Column */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
                VALUE COLUMN {metricOp !== 'COUNT' && <span className="text-[#e85c4c]">*</span>}
              </label>
              <select
                value={valueColumn}
                onChange={(e) => setValueColumn(e.target.value)}
                className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
              >
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type || 'TEXT'})
                  </option>
                ))}
              </select>
            </div>

            {widgetType !== 'kpi_card' ? (
              <div>
                <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
                  GROUP BY DIMENSION <span className="text-[#e85c4c]">*</span>
                </label>
                <select
                  value={groupByColumn}
                  onChange={(e) => setGroupByColumn(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type || 'TEXT'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
                  TARGET BENCHMARK (OPTIONAL)
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>
            )}
          </div>

          {/* Formatting Style */}
          <div>
            <label className="block text-[11px] font-mono text-[#9b9690] mb-1 font-semibold">
              DISPLAY FORMAT
            </label>
            <select
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
              className="w-full px-3 py-2 bg-[#161514] border border-[#2e2c2a] rounded-lg text-[#edeae4] focus:outline-none focus:border-[#e8a84c]"
            >
              <option value="number">Standard Number (1,234)</option>
              <option value="currency_usd">Currency USD ($1,234.00)</option>
              <option value="currency_eur">Currency EUR (€1,234.00)</option>
              <option value="currency_inr">Currency INR (₹1,234.00)</option>
              <option value="percent">Percentage (12.5%)</option>
            </select>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#2e2c2a] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Creating Widget...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Metric Widget</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWidgetModal;
