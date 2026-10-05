import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, Upload, Trash2, RefreshCw } from 'lucide-react';
import type { KnowledgeDocument } from '../types';
import AppBridge from '../services/bridge';

export const DocsView: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await AppBridge.api.getDocuments();
      setDocs(res.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">Knowledge Base</h2>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Ingested organizational documents, PRDs, and hybrid vector/keyword indexed context.
          </p>
        </div>

        <button
          onClick={fetchDocs}
          className="p-2 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
          title="Refresh documents"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e8a84c]' : ''}`} />
        </button>
      </div>

      <div className="flex-1 bg-[#1a1918] border border-[#2e2c2a] rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between text-xs text-[#9b9690]">
          <span>Indexed Files ({docs.length})</span>
          <span className="font-mono text-[11px]">RAG & BM25 Ready</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {docs.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-[#5c5955]">
              <BookOpen className="w-8 h-8 mb-2 opacity-50" />
              <span>No documents indexed yet. Upload PDFs or Markdown files to populate knowledge.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#222120] border border-[#2e2c2a] hover:border-[#3a3835] text-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#1a1918] border border-[#2e2c2a] flex items-center justify-center text-[#e8a84c]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#edeae4]">{doc.filename}</div>
                      <div className="text-[10px] text-[#9b9690] font-mono mt-0.5">
                        {doc.word_count || 0} words · {doc.chunk_count || 0} chunks · {doc.file_type}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#5aab7f]/10 text-[#5aab7f] border border-[#5aab7f]/30">
                    {doc.status || 'indexed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocsView;
