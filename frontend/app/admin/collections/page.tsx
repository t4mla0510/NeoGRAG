'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/admin/AdminLayout';
import { formatDateTime, getSystemHealth, type SystemHealth } from '../api';
import { listFiles, type FileItem } from '../../upload/api';
import { formatBytes } from '../../upload/components';

interface CatalogFile extends FileItem {
  chunkIds?: string[];
}

export default function AdminCollections() {
  const [files, setFiles] = useState<CatalogFile[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const [fileList, healthRes] = await Promise.all([listFiles(), getSystemHealth()]);
        setFiles(fileList as CatalogFile[]);
        setHealth(healthRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
      }
    })();
  }, []);

  const processed = files.filter(f => f.status === 'processed');
  const chunkCount = processed.reduce((sum, f) => sum + (f.chunkIds?.length ?? 0), 0);
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const vectorCount = health?.chroma.vector_count ?? chunkCount;
  const bm25Count = health?.bm25.document_count ?? chunkCount;
  const kg = health?.kg;

  return (
    <AdminLayout
      title="Bộ sưu tập"
      subtitle="Theo dõi collection lưu trữ vector và chỉ mục BM25 của hệ thống RAG."
    >
      {error ? <div className="admin-alert">{error}</div> : null}

      <div className="admin-grid cols-2-1">
        <div className="admin-card">
          <h2 className="admin-card-title">
            academic_regulation
            <span className="admin-chip cyan" style={{ marginLeft: 10 }}>collection</span>
          </h2>
          <p className="admin-card-sub" style={{ marginBottom: 16 }}>
            Collection mặc định của hệ thống — chứa chunks được trích xuất từ các tệp đã xử lý.
          </p>
          <div className="admin-kv">
            <div className="admin-kv-row">
              <span className="admin-kv-key">Tệp đã xử lý</span>
              <span className="admin-kv-val">{processed.length}</span>
            </div>
            <div className="admin-kv-row">
              <span className="admin-kv-key">Vectors trong ChromaDB</span>
              <span className="admin-kv-val">{vectorCount}</span>
            </div>
            <div className="admin-kv-row">
              <span className="admin-kv-key">Docs trong BM25</span>
              <span className="admin-kv-val">{bm25Count}</span>
            </div>
            <div className="admin-kv-row">
              <span className="admin-kv-key">Chunks theo tệp đã xử lý</span>
              <span className="admin-kv-val">{chunkCount}</span>
            </div>
            <div className="admin-kv-row">
              <span className="admin-kv-key">Tổng dung lượng nguồn</span>
              <span className="admin-kv-val">{formatBytes(totalSize)}</span>
            </div>
            <div className="admin-kv-row">
              <span className="admin-kv-key">HNSW space</span>
              <span className="admin-kv-val">cosine</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-card">
            <h2 className="admin-card-title">Knowledge Graph</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className={`admin-dot ${kg?.available ? 'green' : 'red'}`} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {kg?.available ? 'Sẵn sàng' : 'Chưa có đồ thị'}
              </span>
            </div>
            <p className="admin-card-sub">
              {kg?.available
                ? `Cập nhật ${formatDateTime(kg?.updated_at)}`
                : 'Đồ thị tri thức chưa được xây dựng — hãy liên hệ quản trị viên kỹ thuật.'}
            </p>
            {kg?.available ? (
              <Link href="/admin/kg" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }}>
                Mở trình xem
              </Link>
            ) : null}
          </div>

          <div className="admin-note">
            <strong>Lưu ý:</strong> Số vectors (ChromaDB) và docs (BM25) được lấy trực tiếp từ
            backend qua <code>/api/system/health</code>. Backend chưa hỗ trợ quản lý nhiều collection.
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
