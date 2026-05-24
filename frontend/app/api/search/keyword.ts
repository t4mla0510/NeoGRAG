import { KeywordSearchRequest, KeywordSearchResponse } from '@/types/search';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function keywordSearch(
  data: KeywordSearchRequest
): Promise<KeywordSearchResponse> {
  const res = await fetch(`${API_BASE}/search/keyword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Keyword search failed');
  return res.json();
}