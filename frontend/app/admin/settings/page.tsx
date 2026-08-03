'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { formatDateTime, getSystemHealth, getSystemInfo, type SystemHealth, type SystemInfo } from '../api';
import { useAuth } from '../../components/AuthContext';

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const [infoRes, healthRes] = await Promise.all([getSystemInfo(), getSystemHealth()]);
        setInfo(infoRes);
        setHealth(healthRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu hệ thống');
      }
    })();
  }, []);

  const initials = (user?.username || user?.email || 'AD').slice(0, 2).toUpperCase();

  const systemRows = [
    { key: 'Phiên bản', val: info?.version ?? '—' },
    { key: 'Model LLM', val: info?.llm_model ?? '—' },
    { key: 'Embedding model', val: info?.embedding_model ?? '—' },
    { key: 'Collection', val: info?.collection ?? '—' },
    { key: 'Chunking mặc định', val: info ? `${info.chunk_size} / overlap ${info.chunk_overlap}` : '—' },
    { key: 'HNSW space', val: info?.hnsw_space ?? '—' },
  ];

  const infraTiles = [
    {
      label: 'Redis',
      ok: health?.redis.connected ?? false,
      detail: health?.redis.connected ? `${health.redis.latency_ms}ms` : 'Ngắt kết nối',
    },
    {
      label: 'ChromaDB',
      ok: (health?.chroma.vector_count ?? 0) > 0,
      detail: `${health?.chroma.vector_count ?? 0} vectors`,
    },
    {
      label: 'BM25',
      ok: health?.bm25.loaded ?? false,
      detail: `${health?.bm25.document_count ?? 0} docs`,
    },
  ];

  return (
    <AdminLayout
      title="Cài đặt"
      subtitle="Quản lý tài khoản, trạng thái hệ thống và hạ tầng RAG."
    >
      {error ? <div className="admin-alert">{error}</div> : null}

      <div className="admin-grid cols-2-1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-card">
            <h2 className="admin-card-title">Tài khoản</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <span className="admin-user-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {initials}
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.username || 'Admin'}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email || 'Chưa rõ email'}</div>
              </div>
              <span className="admin-chip" style={{ marginLeft: 'auto' }}>Quản trị viên</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="admin-btn admin-btn-ghost"
                type="button"
                disabled
                title="Đổi mật khẩu chưa được backend hỗ trợ"
              >
                <span className="material-symbols-outlined" aria-hidden="true">key</span>
                Đổi mật khẩu
              </button>
              <button
                className="admin-btn admin-btn-danger"
                type="button"
                onClick={() => logout?.()}
              >
                <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                Đăng xuất
              </button>
            </div>
          </div>

          <div className="admin-card">
            <h2 className="admin-card-title">Thông tin hệ thống</h2>
            <div className="admin-kv">
              {systemRows.map(row => (
                <div className="admin-kv-row" key={row.key}>
                  <span className="admin-kv-key">{row.key}</span>
                  <span className="admin-kv-val">{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-card">
            <h2 className="admin-card-title">Trạng thái Knowledge Graph</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className={`admin-dot ${health?.kg.available ? 'green' : 'red'}`} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {health?.kg.available ? 'Sẵn sàng' : 'Chưa có đồ thị'}
              </span>
            </div>
            <div className="admin-kv">
              <div className="admin-kv-row">
                <span className="admin-kv-key">Path</span>
                <span className="admin-kv-val">
                  {health?.kg.available ? 'data/graphify-out/academic_regulation.gpickle' : '—'}
                </span>
              </div>
              <div className="admin-kv-row">
                <span className="admin-kv-key">Cập nhật</span>
                <span className="admin-kv-val">{formatDateTime(health?.kg.updated_at)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={!health?.kg.available}
                onClick={() => window.open('/admin/kg', '_self')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                Mở trình xem
              </button>
              <button className="admin-btn admin-btn-ghost" type="button" disabled title="Chỉ dùng CLI">
                <span className="material-symbols-outlined" aria-hidden="true">construction</span>
                Xây dựng lại KG
              </button>
            </div>
          </div>

          <div className="admin-card">
            <h2 className="admin-card-title">Hạ tầng</h2>
            <div className="admin-grid cols-3" style={{ gap: 12 }}>
              {infraTiles.map(tile => (
                <div className="admin-stat" style={{ padding: 14 }} key={tile.label}>
                  <span className="admin-stat-label">{tile.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span className={`admin-dot ${tile.ok ? 'green' : 'red'}`} />
                    {tile.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
