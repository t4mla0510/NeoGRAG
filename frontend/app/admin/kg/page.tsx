'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import KnowledgeGraph from '../../components/admin/KnowledgeGraph';
import { formatDateTime, graphStatus, kgUrl, type KGStatus } from '../api';

export default function AdminKG() {
  const [kg, setKg] = useState<KGStatus | null>(null);

  useEffect(() => {
    graphStatus()
      .then(setKg)
      .catch(() => setKg({ available: false }));
  }, []);

  const graphKey = kg?.updatedAt ?? 0;
  const graphUrl = `${kgUrl}?v=${graphKey}`;

  return (
    <AdminLayout
      title="Knowledge Graph"
      subtitle="Trực quan hóa đồ thị tri thức học vụ được xây dựng từ các tài liệu đã xử lý."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className={`admin-dot ${kg?.available ? 'green' : 'red'}`} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {kg?.available ? 'Đồ thị sẵn sàng' : 'Đồ thị chưa có'}
        </span>
        {kg?.available ? (
          <span className="admin-chip" style={{ fontSize: 11 }}>
            cập nhật {formatDateTime(kg?.updatedAt)}
          </span>
        ) : null}
        <button
          className="admin-btn admin-btn-ghost"
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginLeft: 'auto' }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          Tải lại
        </button>
      </div>

      {kg?.available ? (
        <KnowledgeGraph key={graphKey} url={graphUrl} />
      ) : (
        <div className="admin-card">
          <h2 className="admin-card-title">Chưa có đồ thị tri thức</h2>
          <p className="admin-card-sub">
            Đồ thị tri thức chưa được xây dựng cho hệ thống. Vui lòng liên hệ quản trị viên kỹ thuật
            để thiết lập.
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
