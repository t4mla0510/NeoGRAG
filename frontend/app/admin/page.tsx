'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../components/admin/AdminLayout';
import { formatDateTime, getSystemHealth, graphStatus, type KGStatus, type SystemHealth } from './api';
import { listFiles, type FileItem } from '../upload/api';
import { formatBytes, StatusPill } from '../upload/components';

export default function AdminOverview() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [kg, setKg] = useState<KGStatus | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const [fileList, kgStatus, healthRes] = await Promise.all([
          listFiles(),
          graphStatus(),
          getSystemHealth(),
        ]);
        setFiles(fileList);
        setKg(kgStatus);
        setHealth(healthRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = {
    uploaded: files.filter(f => f.status === 'uploaded').length,
    processing: files.filter(f => f.status === 'processing').length,
    processed: files.filter(f => f.status === 'processed').length,
    failed: files.filter(f => f.status === 'failed').length,
    totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
  };

  const recent = [...files]
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))
    .slice(0, 6);

  return (
    <AdminLayout title="Tổng quan hệ thống RAG" subtitle="Giám sát nguồn dữ liệu, trạng thái xử lý và Knowledge Graph.">
      {error ? <div className="admin-alert">{error}</div> : null}

      {loading ? (
        <div className="admin-loading" aria-live="polite">
          <span /><span /><span />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-grid cols-3">
            <div className="admin-stat">
              <span className="admin-stat-label">
                <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
                Tổng tệp nguồn
              </span>
              <span className="admin-stat-value">{files.length}</span>
              <span className="admin-stat-hint">{formatBytes(counts.totalSize)} tổng dung lượng</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">
                <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                Đã xử lý
              </span>
              <span className="admin-stat-value">{counts.processed}</span>
              <span className="admin-stat-hint">
                {counts.processing > 0 ? `${counts.processing} đang xử lý` : 'sẵn sàng truy vấn'}
              </span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">
                <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                Knowledge Graph
              </span>
              <span className="admin-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`admin-dot ${kg?.available ? 'green' : 'red'}`} />
                {kg?.available ? 'Sẵn sàng' : 'Chưa có'}
              </span>
              <span className="admin-stat-hint">
                {kg?.available ? `cập nhật ${formatDateTime(kg?.updatedAt)}` : 'chạy CLI build-kg'}
              </span>
            </div>
          </div>

          <div className="admin-grid cols-2-1">
            <div className="admin-table-wrap">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Tệp gần đây</h2>
                <Link href="/admin/files" className="admin-btn admin-btn-ghost">
                  Xem tất cả
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="admin-note" style={{ margin: 16 }}>Chưa có tệp nguồn nào. Hãy tải lên tài liệu đầu tiên.</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Loại</th>
                      <th>Kích thước</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(file => (
                      <tr key={file.id}>
                        <td className="name-cell">
                          <span className="material-symbols-outlined" aria-hidden="true">draft</span>
                          {file.name}
                        </td>
                        <td>{file.type.toUpperCase()}</td>
                        <td>{formatBytes(file.size)}</td>
                        <td><StatusPill status={file.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="admin-card" style={{ alignSelf: 'start' }}>
              <h2 className="admin-card-title">Trạng thái hệ thống</h2>
              <div className="admin-kv">
                <div className="admin-kv-row">
                  <span className="admin-kv-key">Collection</span>
                  <span className="admin-kv-val">academic_regulation</span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-key">Vectors (ChromaDB)</span>
                  <span className="admin-kv-val">{health?.chroma.vector_count ?? '—'}</span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-key">Docs (BM25)</span>
                  <span className="admin-kv-val">{health?.bm25.document_count ?? '—'}</span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-key">KG artifact</span>
                  <span className="admin-kv-val">{kg?.available ? 'academic_regulation.gpickle' : '—'}</span>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-key">Chunking mặc định</span>
                  <span className="admin-kv-val">500 / 50</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
