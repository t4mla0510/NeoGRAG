import { GraphSearchRequest, GraphSearchResponse } from '@/types/search';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function graphSearch(
  data: GraphSearchRequest
): Promise<GraphSearchResponse> {
  const res = await fetch(`${API_BASE}/search/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Graph search failed');
  return res.json();
}