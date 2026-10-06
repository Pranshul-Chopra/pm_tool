import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { DataSource } from '../../types';

interface DeleteDatasetModalProps {
  isOpen: boolean;
  dataset: DataSource | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDatasetModal: React.FC<DeleteDatasetModalProps> = ({
  isOpen,
  dataset,
  loading,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !dataset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#1a1918] border border-[#2e2c2a] rounded-xl shadow-2xl overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#e85c4c]/10 border border-[#e85c4c]/20 flex items-center justify-center text-[#e85c4c] flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-bold text-[#edeae4]">Delete Connected Dataset</h3>
            <p className="text-xs text-[#9b9690] mt-1 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-[#edeae4]">"{dataset.name}"</span>?
            </p>
            <div className="mt-3 p-3 rounded-lg bg-[#222120] border border-[#2e2c2a] text-[11px] text-[#e8a84c] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Its materialized table in analytics_store.db ({dataset.row_count || 0} rows) will be permanently dropped. This action cannot be undone.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs text-[#9b9690] hover:text-[#edeae4] hover:bg-[#222120] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-[#e85c4c] hover:bg-[#d44838] text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Dataset</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteDatasetModal;
