export interface VectorSearchRequest {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  top_k?: number;
}

export interface VectorSearchResult {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface VectorSearchResponse {
  query: string;
  results: VectorSearchResult[];
}

export interface KeywordSearchRequest {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  top_k?: number;
}

export interface KeywordSearchResult {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface KeywordSearchResponse {
  query: string;
  results: KeywordSearchResult[];
}

export interface GraphSearchRequest {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  hops?: number;
  top_neighbors?: number;
}

export interface GraphSearchResponse {
  resolved_entities: string[];
  graph_context: string;
  graph_score: number;
}

export interface HybridSearchRequest {
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  top_k?: number;
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
  enhanced_query: string;
  results: HybridSearchResult[];
}