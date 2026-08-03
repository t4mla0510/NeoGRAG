'use client';

import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { graphSearch, hybridSearch, type GraphSearchResponse, type HybridSearchResponse } from '../api';

type Mode = 'hybrid' | 'vector' | 'keyword' | 'graph';

const MODES: { id: Mode; label: string; badge: string; disabled?: boolean }[] = [
  { id: 'hybrid', label: 'Hybrid (RRF)', badge: 'hybridSearch' },
  { id: 'vector', label: 'Vector', badge: 'vectorSearch', disabled: true },
  { id: 'keyword', label: 'BM25 / Keyword', badge: 'keywordSearch', disabled: true },
  { id: 'graph', label: 'Knowledge Graph', badge: 'graphSearch' },
];

const SAMPLE_QUERY = 'điều kiện xét tốt nghiệp đại học';

export default function AdminSearch() {
  const [mode, setMode] = useState<Mode>('hybrid');
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [hybrid, setHybrid] = useState<HybridSearchResponse | null>(null);
  const [graph, setGraph] = useState<GraphSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || searching) return;

    setError('');
    setSearching(true);
    setHybrid(null);
    setGraph(null);
    const started = performance.now();

    try {
      if (mode === 'graph') {
        setGraph(await graphSearch(trimmed));
      } else {
        setHybrid(await hybridSearch(trimmed));
      }
      setElapsedMs(Math.round(performance.now() - started));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tìm kiếm thất bại');
    } finally {
      setSearching(false);
    }
  };

  const sourceOf = (metadata: Record<string, unknown>): string => {
    const source = metadata.source;
    const name = metadata.file_name;
    return typeof source === 'string' && source ? source : typeof name === 'string' ? name : 'unknown';
  };

  return (
    <AdminLayout
      title="Thử nghiệm tìm kiếm"
      subtitle="Kiểm tra trực tiếp các truy vấn qua vector, BM25, knowledge graph và hybrid."
    >
      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-seg" role="tablist" aria-label="Chế độ tìm kiếm">
          {MODES.map(m => (
            <button
              key={m.id}
              role="tab"
              type="button"
              className={mode === m.id ? 'active' : ''}
              disabled={m.disabled}
              title={m.disabled ? 'Vector và BM25 được hợp nhất trong kết quả Hybrid' : undefined}
              onClick={() => setMode(m.id)}
            >
              {m.label}
              <span className="admin-seg-badge">{m.badge}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <input
            className="admin-input"
            style={{ flex: 1 }}
            value={query}
            placeholder="Nhập truy văn bằng tiếng Việt..."
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') runSearch();
            }}
            aria-label="Truy vấn"
          />
          <button className="admin-btn admin-btn-primary" type="button" disabled={searching} onClick={runSearch}>
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            {searching ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>

        {hybrid?.search_query && hybrid.search_query !== hybrid.query ? (
          <p className="admin-input-hint" style={{ marginTop: 10 }}>
            Query mở rộng: {hybrid.search_query}
            {hybrid.enhanced_query ? ` (${hybrid.enhanced_query})` : ''}
          </p>
        ) : null}
      </div>

      {error ? <div className="admin-alert">{error}</div> : null}

      <div className="admin-grid cols-2-1">
        <div className="admin-table-wrap">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="admin-card-title" style={{ margin: 0 }}>
              {mode === 'graph' ? 'Đồ thị tri thức' : 'Kết quả'}
            </h2>
            {elapsedMs !== null ? <span className="admin-chip">{elapsedMs}ms</span> : null}
          </div>

          {!hybrid && !graph ? (
            <div className="admin-note" style={{ margin: 16 }}>
              Nhập truy vấn và bấm Tìm kiếm để kiểm tra pipeline truy hồi. Mặc định chạy Hybrid
              (vector + BM25 + rerank LLM).
            </div>
          ) : null}

          {hybrid ? (
            hybrid.results.length === 0 ? (
              <div className="admin-note" style={{ margin: 16 }}>Không có kết quả phù hợp.</div>
            ) : (
              hybrid.results.map((result, index) => (
                <div className="admin-result" key={result.id}>
                  <div className="admin-result-head">
                    <span className="admin-result-rank">{index + 1}</span>
                    <span className="admin-result-title">{sourceOf(result.metadata)}</span>
                    <span className="admin-chip cyan">{result.combined_score.toFixed(2)}</span>
                  </div>
                  <p className="admin-result-snippet">{result.document.slice(0, 320)}</p>
                  <div className="admin-result-meta">
                    <span className="admin-chip">vector {result.semantic_score.toFixed(2)}</span>
                    <span className="admin-chip">bm25 {result.keyword_score.toFixed(2)}</span>
                    <span className="admin-chip">chunk #{String(result.metadata.chunk_index ?? '?')}</span>
                  </div>
                </div>
              ))
            )
          ) : null}

          {graph ? (
            <div style={{ padding: 18 }}>
              <div className="admin-result-meta" style={{ marginBottom: 12 }}>
                <span className="admin-chip">graph_score {graph.graph_score.toFixed(2)}</span>
                <span className="admin-chip">{graph.resolved_entities.length} thực thể</span>
              </div>
              {graph.resolved_entities.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {graph.resolved_entities.map(entity => (
                    <span className="admin-chip cyan" key={entity}>{entity}</span>
                  ))}
                </div>
              ) : null}
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Context đồ thị</h3>
              <pre
                className="admin-code"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {graph.graph_context || '(trống — không có thực thể nào khớp trong đồ thị)'}
              </pre>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-card">
            <h2 className="admin-card-title">Hồ sơ truy vấn</h2>
            <div className="admin-kv">
              <div className="admin-kv-row">
                <span className="admin-kv-key">Chế độ</span>
                <span className="admin-kv-val">{mode === 'graph' ? 'graph' : 'hybrid'}</span>
              </div>
              <div className="admin-kv-row">
                <span className="admin-kv-key">Thời gian</span>
                <span className="admin-kv-val">{elapsedMs !== null ? `${elapsedMs}ms` : '—'}</span>
              </div>
              <div className="admin-kv-row">
                <span className="admin-kv-key">Nguồn</span>
                <span className="admin-kv-val">
                  {mode === 'graph'
                    ? 'knowledge graph'
                    : 'vector + bm25'}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-note">
            <strong>Rerank LLM:</strong> kết quả Hybrid được rerank bằng LLM khi dịch vụ khả dụng.
            Thông tin cache hit/miss và chi tiết rerank cần endpoint riêng để hiển thị.
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
