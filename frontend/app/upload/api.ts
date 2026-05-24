export type FileStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type FileType = 'docx' | 'pdf' | 'txt' | 'md';
export type BuildTarget = 'vector' | 'bm25' | 'retrieval' | 'all';

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size: number;
  uploadedAt: string;
  status: FileStatus;
  lastProcessedAt?: string | null;
}

export interface ProcessingConfig {
  fileId: string;
  chunk_size: number;
  chunk_overlap: number;
  markdown_headers?: {
    enabled: boolean;
    levels: number[];
    preserveHierarchy: boolean;
  };
  buildTarget: BuildTarget;
}

const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_BASE = configuredApiBase.includes('://backend:') ? '' : configuredApiBase;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'Request failed');
  }
  return payload as T;
}

export const graphUrl = `${API_BASE}/api/knowledge-graph/academic-regulation`;

export async function listFiles(): Promise<FileItem[]> {
  const payload = await requestJson<{ files: FileItem[] }>('/api/files');
  return payload.files;
}

export async function uploadFiles(files: File[]): Promise<FileItem[]> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const payload = await requestJson<{ files: FileItem[] }>('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
  return payload.files;
}

export async function deleteFile(fileId: string): Promise<void> {
  await requestJson(`/api/files/${fileId}`, { method: 'DELETE' });
}

export async function deleteFiles(fileIds: string[]): Promise<void> {
  await requestJson('/api/files/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: fileIds }),
  });
}

export async function startProcessing(configs: ProcessingConfig[]) {
  return requestJson('/api/process/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configs }),
  });
}
