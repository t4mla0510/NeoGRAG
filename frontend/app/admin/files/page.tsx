'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from '../../components/admin/AdminLayout';
import '../../upload/Upload.css';
import {
  deleteFile,
  deleteFiles,
  graphUrl,
  listFiles,
  startProcessing,
  uploadFiles,
  type FileItem,
} from '../../upload/api';
import {
  EmptyState,
  StatusPill,
  acceptedExtensions,
  formatBytes,
  formatDate,
} from '../../upload/components';

const defaultChunkSize = 500;
const defaultChunkOverlap = 50;

export default function AdminFiles() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const refreshFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const nextFiles = await listFiles();
      setFiles(nextFiles);
      setSelectedIds(ids => ids.filter(id => nextFiles.some(file => file.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách tệp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  const selectedFiles = useMemo(
    () => files.filter(file => selectedIds.includes(file.id)),
    [files, selectedIds]
  );

  const uploadCandidateFiles = async (incoming: File[]) => {
    const valid: File[] = [];
    const rejected: string[] = [];

    incoming.forEach(file => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (acceptedExtensions.includes(ext)) valid.push(file);
      else rejected.push(file.name);
    });

    if (rejected.length) toast.error(`Định dạng tệp không được hỗ trợ: ${rejected.join(', ')}`);
    if (!valid.length) return;

    setUploading(true);
    try {
      await uploadFiles(valid);
      toast.success('Tải lên tệp thành công');
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tải lên thất bại');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async (ids: string[]) => {
    if (!ids.length) return;
    const label = ids.length === 1 ? 'tệp này' : `${ids.length} tệp`;
    if (!window.confirm(`Xóa ${label}? Hành động này không thể hoàn tác.`)) return;

    try {
      if (ids.length === 1) await deleteFile(ids[0]);
      else await deleteFiles(ids);
      toast.success('Xóa thành công');
      setSelectedIds(current => current.filter(id => !ids.includes(id)));
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const runProcessing = async (filesToProcess = selectedFiles) => {
    if (!filesToProcess.length || processing) return;

    const payload = filesToProcess.map(file => ({
      fileId: file.id,
      chunk_size: defaultChunkSize,
      chunk_overlap: defaultChunkOverlap,
      markdown_headers: {
        enabled: file.type === 'md',
        levels: file.type === 'md' ? [1, 2, 3] : [],
        preserveHierarchy: file.type === 'md',
      },
      buildTarget: 'retrieval' as const,
    }));

    setProcessing(true);
    try {
      const { results } = await startProcessing(payload);
      if (results?.length) {
        setFiles(current => {
          const updates = new Map(results.map(r => [r.file.id, r.file]));
          return current.map(file => updates.get(file.id) ?? file);
        });
        setSelectedIds(ids =>
          ids.filter(id => !results.some(r => r.file.id === id && r.error))
        );
      }
      const failures = results?.filter(r => r.error).length ?? 0;
      if (failures > 0) toast.error(`${failures} tệp xử lý thất bại`);
      else toast.success('Xử lý thành công');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xử lý thất bại');
      await refreshFiles();
    } finally {
      setProcessing(false);
    }
  };

  const openKnowledgeGraph = () => {
    window.open(graphUrl, '_blank', 'noopener,noreferrer');
  };

  const allSelected = files.length > 0 && selectedIds.length === files.length;

  return (
    <AdminLayout
      title="Nguồn dữ liệu"
      subtitle="Tải lên các tệp nguồn và xử lý chúng bằng đường ống RAG (Vector + BM25)."
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
        <button className="admin-btn admin-btn-ghost" type="button" onClick={openKnowledgeGraph}>
          <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
          Đồ thị tri thức
        </button>
        <button className="admin-btn admin-btn-ghost" type="button" onClick={refreshFiles}>
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          Làm mới
        </button>
      </div>

      <FilesDropzone uploading={uploading} onUpload={uploadCandidateFiles} />

      {error ? <div className="admin-alert">{error}</div> : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '14px 0' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>{selectedIds.length} đã chọn</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="admin-btn admin-btn-primary"
            type="button"
            disabled={!selectedFiles.length || processing}
            onClick={() => runProcessing(selectedFiles)}
            title="Xử lý với Vector và BM25, kích thước chunk 500, độ chồng lấn 50"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {processing ? 'progress_activity' : 'play_arrow'}
            </span>
            {processing ? 'Đang xử lý...' : 'Xử lý đã chọn'}
          </button>
          <button
            className="admin-btn admin-btn-danger"
            type="button"
            disabled={!selectedIds.length}
            onClick={() => confirmDelete(selectedIds)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
            Xóa đã chọn
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading" aria-live="polite">
          <span /><span /><span />
        </div>
      ) : null}

      {!loading && files.length === 0 ? (
        <EmptyState title="Chưa có tệp nguồn" description="Thêm tài liệu, sau đó xử lý chúng bằng Vector và BM25." />
      ) : null}

      {!loading && files.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    aria-label="Chọn tất cả tệp"
                    type="checkbox"
                    checked={allSelected}
                    onChange={event =>
                      setSelectedIds(event.target.checked ? files.map(file => file.id) : [])
                    }
                  />
                </th>
                <th>Tên</th>
                <th>Loại</th>
                <th>Kích thước</th>
                <th>Trạng thái</th>
                <th>Đã tải lên</th>
                <th>Xử lý lần cuối</th>
                <th style={{ width: 120 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id}>
                  <td>
                    <input
                      aria-label={`Select ${file.name}`}
                      type="checkbox"
                      checked={selectedIds.includes(file.id)}
                      onChange={event =>
                        setSelectedIds(
                          event.target.checked
                            ? [...selectedIds, file.id]
                            : selectedIds.filter(id => id !== file.id)
                        )
                      }
                    />
                  </td>
                  <td className="name-cell">
                    <span className="material-symbols-outlined" aria-hidden="true">draft</span>
                    {file.name}
                  </td>
                  <td>{file.type.toUpperCase()}</td>
                  <td>{formatBytes(file.size)}</td>
                  <td><StatusPill status={file.status} /></td>
                  <td>{formatDate(file.uploadedAt)}</td>
                  <td>{formatDate(file.lastProcessedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="admin-btn admin-btn-primary"
                        type="button"
                        style={{ minHeight: 30, padding: '0 9px', fontSize: 12, boxShadow: 'none' }}
                        disabled={processing || file.status === 'processing'}
                        onClick={() => runProcessing([file])}
                        title="Xử lý với Vector và BM25"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                      </button>
                      <button
                        className="admin-btn admin-btn-danger"
                        type="button"
                        style={{ minHeight: 30, padding: '0 9px', fontSize: 12 }}
                        onClick={() => confirmDelete([file.id])}
                        title="Xóa tệp"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ToastContainer position="top-right" autoClose={3000} />
    </AdminLayout>
  );
}

function FilesDropzone({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    onUpload(Array.from(event.dataTransfer.files));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onUpload(Array.from(event.target.files || []));
    event.target.value = '';
  };

  return (
    <label
      className="admin-dropzone"
      style={{
        display: 'flex',
        minHeight: 170,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: dragging ? '2px dashed #00afef' : '2px dashed rgba(31, 92, 169, 0.42)',
        borderRadius: 8,
        background: dragging ? '#f0f7ff' : '#ffffff',
        color: '#1f5ca9',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
      onDragOver={event => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedExtensions.join(',')}
        multiple
        onChange={handleChange}
        hidden
      />
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 38 }}>
        upload_file
      </span>
      <strong style={{ fontSize: 17 }}>
        {uploading ? 'Đang tải lên tệp...' : 'Kéo tệp vào đây hoặc chọn từ máy tính'}
      </strong>
      <small style={{ color: '#64748b' }}>Chấp nhận: DOCX, PDF, TXT, Markdown</small>
    </label>
  );
}
