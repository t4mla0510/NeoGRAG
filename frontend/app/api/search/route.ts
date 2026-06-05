import { NextRequest, NextResponse } from 'next/server';
import { hybridSearch } from './hybrid';
import { graphSearch } from './graph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, history, searchType } = body;

    let result;

    switch (searchType) {
      case 'hybrid':
        result = await hybridSearch({ query, history });
        break;
      case 'graph':
        result = await graphSearch({ query, history });
        break;
      default:
        result = await hybridSearch({ query, history });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}