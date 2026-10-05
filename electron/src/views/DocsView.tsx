import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  Search,
  Layers,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
  FileUp,
} from 'lucide-react';
import type { KnowledgeDocument } from '../types';
import AppBridge from '../services/bridge';

export const DocsView: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk Inspector Drawer
  const [inspectDoc, setInspectDoc] = useState<KnowledgeDocument | null>(null);
  const [inspectChunks, setInspectChunks] = useState<any[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // RAG Search Test Bench
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testingQuery, setTestingQuery] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await AppBridge.api.getDocuments();
      setDocs(res.documents || []);
      setTotalChunks(res.total_chunks || 0);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadStatus(null);

    try {
      const res = await AppBridge.api.uploadDocument(formData);
      if (res.success) {
        setUploadStatus({
          type: 'success',
          message: `Successfully ingested "${file.name}" with ${res.document?.chunk_count || 0} chunks.`,
        });
        fetchDocs();
      } else {
        setUploadStatus({ type: 'error', message: 'Upload completed with warnings.' });
      }
    } catch (err: any) {
      setUploadStatus({ type: 'error', message: err.message || 'Failed to upload document.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: number, filename: string) => {
    if (!window.confirm(`Permanently remove "${filename}" and all its vector chunks from Knowledge Base?`)) {
      return;
    }

    try {
      await AppBridge.api.deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (inspectDoc && inspectDoc.id === docId) {
        setInspectDoc(null);
      }
    } catch (err: any) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const handleInspectChunks = async (doc: KnowledgeDocument) => {
    setInspectDoc(doc);
    setLoadingChunks(true);
    try {
      const res = await AppBridge.api.getDocumentChunks(doc.id);
      setInspectChunks(res.chunks || []);
    } catch (err) {
      console.error('Failed to fetch chunks:', err);
      setInspectChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleTestSearch = async () => {
    if (!testQuery.trim()) return;
    setTestingQuery(true);
    try {
      const res = await AppBridge.api.queryDocuments(testQuery.trim(), undefined, 4);
      setTestResults(res.chunks || []);
    } catch (err: any) {
      console.error('RAG test search failed:', err);
      setTestResults([]);
    } finally {
      setTestingQuery(false);
    }
  };

  const filteredDocs = docs.filter(
    (d) =>
      !searchQuery ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.file_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-hidden space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2e2c2a] flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">
              Knowledge Base & RAG Index
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e8a84c]/10 text-[#e8a84c] border border-[#e8a84c]/30 font-semibold">
              Hybrid Vector + BM25
            </span>
          </div>
          <p className="text-xs text-[#9b9690] mt-0.5">
            Ingest local PRDs, PDFs, DOCX, and Markdown documents to ground AI Copilot reasoning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3.5 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
            <span>{uploading ? 'Ingesting...' : 'Upload Document'}</span>
          </button>

          <button
            onClick={fetchDocs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
            title="Refresh documents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e8a84c]' : ''}`} />
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

      {/* Main Split Layout: Documents List (Left) + RAG Test Bench & Inspector (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
        {/* Left Column: Documents Manager (7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-[#161514] border border-[#2e2c2a] rounded-xl overflow-hidden min-h-0">
          <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918] flex-shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-[#5c5955] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search indexed files..."
                className="w-full bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg pl-8 pr-3 py-1 text-xs text-[#edeae4] focus:outline-none"
              />
            </div>

            <div className="text-[11px] font-mono text-[#9b9690]">
              <span>{filteredDocs.length} files</span>
              <span className="text-[#5c5955] mx-1.5">·</span>
              <span className="text-[#e8a84c]">{totalChunks} total chunks</span>
            </div>
          </div>

          {/* Documents Table / Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDocs.length === 0 && !loading ? (
              <div className="h-48 border border-dashed border-[#2e2c2a] rounded-xl flex flex-col items-center justify-center text-xs text-[#5c5955] p-6 text-center">
                <FileUp className="w-8 h-8 mb-2 opacity-50 text-[#e8a84c]" />
                <span className="font-medium text-[#edeae4]">No documents ingested yet</span>
                <span className="text-[11px] mt-1 text-[#9b9690]">
                  Drop a PDF, DOCX, or Markdown PRD to empower AI Copilot with organizational context.
                </span>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-3 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    inspectDoc?.id === doc.id
                      ? 'bg-[#222120] border-[#e8a84c]/50'
                      : 'bg-[#1a1918] border-[#2e2c2a] hover:border-[#3a3835]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-[#222120] border border-[#2e2c2a] flex items-center justify-center text-[#e8a84c] flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="truncate">
                      <div className="font-semibold text-[#edeae4] truncate">{doc.filename}</div>
                      <div className="text-[10px] text-[#9b9690] font-mono mt-0.5 flex items-center gap-2">
                        <span>{doc.word_count || 0} words</span>
                        <span>·</span>
                        <span className="text-[#e8a84c] font-bold">{doc.chunk_count || 0} chunks</span>
                        <span>·</span>
                        <span className="uppercase">{doc.file_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleInspectChunks(doc)}
                      className="px-2 py-1 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[11px] text-[#9b9690] hover:text-[#edeae4] transition-colors flex items-center gap-1"
                      title="Inspect semantic chunks"
                    >
                      <Layers className="w-3 h-3 text-[#e8a84c]" />
                      <span>Chunks</span>
                    </button>

                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      className="p-1 rounded text-[#5c5955] hover:text-[#e85c4c] hover:bg-[#e85c4c]/10 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Chunk Inspector or RAG Test Bench (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4 overflow-hidden min-h-0">
          {/* RAG Query Test Bench */}
          <div className="bg-[#161514] border border-[#2e2c2a] rounded-xl p-4 flex flex-col flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#edeae4] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#e8a84c]" />
                <span>RAG Retrieval Test Bench</span>
              </span>
              <span className="text-[10px] font-mono text-[#5aab7f]">Live Evaluator</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                placeholder="Ask a question or enter keywords..."
                className="flex-1 bg-[#111110] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-1.5 text-xs text-[#edeae4] focus:outline-none"
              />
              <button
                onClick={handleTestSearch}
                disabled={testingQuery || !testQuery.trim()}
                className="px-3 py-1.5 bg-[#e8a84c] hover:bg-[#d4973b] disabled:opacity-50 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1"
              >
                {testingQuery ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                <span>Retrieve</span>
              </button>
            </div>

            {testResults && (
              <div className="max-h-44 overflow-y-auto space-y-2 pt-1 border-t border-[#2e2c2a]">
                {testResults.length === 0 ? (
                  <div className="text-[11px] text-[#5c5955] text-center py-2">
                    No relevant chunks retrieved for query.
                  </div>
                ) : (
                  testResults.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[#1a1918] border border-[#2e2c2a] text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[#e8a84c] font-mono text-[10px]">
                        <span>{chunk.filename || 'Document'}</span>
                        <span>Score: {chunk.score ? chunk.score.toFixed(3) : 'High'}</span>
                      </div>
                      <p className="text-[#9b9690] line-clamp-3 leading-relaxed">
                        {chunk.content || chunk.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Chunk Inspector Card */}
          <div className="flex-1 bg-[#161514] border border-[#2e2c2a] rounded-xl flex flex-col overflow-hidden min-h-0">
            <div className="p-3 border-b border-[#2e2c2a] flex items-center justify-between bg-[#1a1918] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#e8a84c]" />
                <span className="text-xs font-semibold text-[#edeae4]">
                  {inspectDoc ? `Chunks: ${inspectDoc.filename}` : 'Chunk Inspector'}
                </span>
              </div>

              {inspectDoc && (
                <button
                  onClick={() => setInspectDoc(null)}
                  className="p-1 rounded text-[#9b9690] hover:text-[#edeae4]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!inspectDoc ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-[#5c5955] text-center p-4">
                  <Layers className="w-8 h-8 mb-2 opacity-40" />
                  <span>Click "Chunks" on any document to inspect its indexed vector boundaries.</span>
                </div>
              ) : loadingChunks ? (
                <div className="text-xs text-[#9b9690] py-8 text-center font-mono animate-pulse">
                  Loading semantic chunks...
                </div>
              ) : inspectChunks.length === 0 ? (
                <div className="text-xs text-[#5c5955] py-8 text-center">No chunks recorded.</div>
              ) : (
                inspectChunks.map((c, i) => (
                  <div
                    key={c.id || i}
                    className="p-3 rounded-lg bg-[#1a1918] border border-[#2e2c2a] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#9b9690]">
                      <span className="text-[#e8a84c]">Chunk #{c.chunk_index ?? i + 1}</span>
                      <span>{c.word_count || 0} words</span>
                    </div>
                    <p className="text-[11px] text-[#edeae4] leading-relaxed whitespace-pre-wrap font-sans">
                      {c.chunk_text || c.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsView;
