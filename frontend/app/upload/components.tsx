import React from 'react';
import type { FileItem } from './api';

export const acceptedExtensions = ['.docx', '.pdf', '.txt', '.md'];

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Chưa xử lý';
  return new Intl.DateTimeFormat('vi', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function statusIcon(status: FileItem['status']): string {
  if (status === 'processed') return 'check_circle';
  if (status === 'processing') return 'progress_activity';
  if (status === 'failed') return 'error';
  return 'upload_file';
}

const statusLabels: Record<FileItem['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
};

export function StatusPill({ status }: { status: FileItem['status'] }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="material-symbols-outlined" aria-hidden="true">{statusIcon(status)}</span>
      {statusLabels[status]}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="dashboard-empty">
      <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
