import { HybridSearchRequest, HybridSearchResponse } from '@/types/search';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function hybridSearch(
  data: HybridSearchRequest
): Promise<HybridSearchResponse> {
  const res = await fetch(`${API_BASE}/search/hybrid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Hybrid search failed');
  return res.json();
}