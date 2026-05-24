import { tool } from 'ai';
import { z } from 'zod';
import { vectorSearch, keywordSearch, graphSearch, hybridSearch } from '@/api/search';

export const vectorSearchTool = tool({
  description:
    'Semantic search using vector embeddings. Best for understanding meaning and context. Use when the query involves semantic understanding, synonyms, or conceptual matching.',
  inputSchema: z.object({
    query: z.string().describe('The search query text'),
    top_k: z.number().optional().describe('Number of results to return (default: 5)'),
  }),
  execute: async ({ query, top_k = 5 }) => {
    return vectorSearch({ query, top_k });
  },
});

export const keywordSearchTool = tool({
  description:
    'Keyword-based search using BM25 algorithm. Best for exact term matching, specific phrases, or when you need precise keyword hits.',
  inputSchema: z.object({
    query: z.string().describe('The search query text'),
    top_k: z.number().optional().describe('Number of results to return (default: 5)'),
  }),
  execute: async ({ query, top_k = 5 }) => {
    return keywordSearch({ query, top_k });
  },
});

export const graphSearchTool = tool({
  description:
    'Knowledge graph lookup for entity resolution and relationship discovery. Use to find connected entities, graph context, and semantic relationships in the academic knowledge graph.',
  inputSchema: z.object({
    query: z.string().describe('The search query text'),
    hops: z.number().optional().describe('Graph traversal depth (default: 2)'),
    top_neighbors: z.number().optional().describe('Max neighbors per node (default: 12)'),
  }),
  execute: async ({ query, hops = 2, top_neighbors = 12 }) => {
    return graphSearch({ query, hops, top_neighbors });
  },
});

export const hybridSearchTool = tool({
  description:
    'Combined search using BM25 keyword matching + vector semantic similarity + LLM reranking. Best general-purpose search for academic regulations and policies.',
  inputSchema: z.object({
    query: z.string().describe('The search query text'),
    top_k: z.number().optional().describe('Number of results to return (default: 5)'),
  }),
  execute: async ({ query, top_k = 5 }) => {
    return hybridSearch({ query, top_k });
  },
});

export const searchTools = {
  vectorSearch: vectorSearchTool,
  keywordSearch: keywordSearchTool,
  graphSearch: graphSearchTool,
  hybridSearch: hybridSearchTool,
};