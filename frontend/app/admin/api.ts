const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_BASE = configuredApiBase.includes('://backend:') ? '' : configuredApiBase;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'Request failed');
  }
  return payload as T;
}

export const kgUrl = `${API_BASE}/api/knowledge-graph/academic-regulation`;

export interface KGStatus {
  available: boolean;
  path?: string;
  updatedAt?: number | null;
  url?: string;
}

export interface SystemInfo {
  version: string;
  llm_model: string;
  embedding_model: string;
  collection: string;
  chunk_size: number;
  chunk_overlap: number;
  hnsw_space: string;
}

export interface SystemHealth {
  redis: { connected: boolean; latency_ms?: number | null; error?: string };
  chroma: {
    collections: { name: string; count: number }[];
    vector_count: number;
    error?: string;
  };
  bm25: { loaded: boolean; document_count: number; error?: string };
  kg: { available: boolean; updated_at?: number | null; error?: string };
}

export async function graphStatus(): Promise<KGStatus> {
  return requestJson('/api/knowledge-graph/status');
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return requestJson('/api/system/info');
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return requestJson('/api/system/health');
}

export interface HybridSearchResult {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  semantic_score: number;
  keyword_score: number;
  combined_score: number;
}

export interface HybridSearchResponse {
  query: string;
  search_query: string;
  llm_context?: string;
  enhanced_query?: string;
  results: HybridSearchResult[];
}

export async function hybridSearch(query: string, top_k = 10): Promise<HybridSearchResponse> {
  return requestJson('/search/hybrid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k }),
  });
}

export interface GraphSearchResponse {
  resolved_entities: string[];
  graph_context: string;
  graph_score: number;
}

export async function graphSearch(
  query: string,
  hops = 2,
  top_neighbors = 12
): Promise<GraphSearchResponse> {
  return requestJson('/search/graph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, hops, top_neighbors }),
  });
}

export function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('vi').format(value);
}

export function formatDateTime(value?: number | null): string {
  if (!value) return 'Chưa rõ';
  return new Intl.DateTimeFormat('vi', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value * 1000));
}
