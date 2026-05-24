'use client';

import React, { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../components/AuthContext';
import {
  FileItem,
  deleteFile,
  deleteFiles,
  graphUrl,
  listFiles,
  startProcessing,
  uploadFiles,
} from './api';
import {
  EmptyState,
  StatusPill,
  acceptedExtensions,
  formatBytes,
  formatDate,
} from './components';
import './Upload.css';

const defaultChunkSize = 500;
const defaultChunkOverlap = 50;

export default function Upload() {
  const router = useRouter();
  const { logout } = useAuth();
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

  const handleLogout = async () => {
    await logout?.();
    router.replace('/auth');
  };

  const uploadCandidateFiles = async (incoming: File[]) => {
    const valid: File[] = [];
    const rejected: string[] = [];

    incoming.forEach(file => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (acceptedExtensions.includes(ext)) {
        valid.push(file);
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length) {
      toast.error(`Định dạng tệp không được hỗ trợ: ${rejected.join(', ')}`);
    }

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
      if (ids.length === 1) {
        await deleteFile(ids[0]);
      } else {
        await deleteFiles(ids);
      }
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
      await startProcessing(payload);
      toast.success('Xử lý Thành công');
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xử lý thất bại');
      await refreshFiles();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <Link href="/" className="dashboard-brand" aria-label="Go to REBot home">
          <Image src="/assets/logo.png" alt="" width={120} height={40} />
          <span>REBot</span>
        </Link>
        <button className="dashboard-ghost-button" type="button" onClick={handleLogout} aria-label="Đăng xuất">
          <span className="material-symbols-outlined" aria-hidden="true">logout</span>
        </button>
      </header>

      <div className="dashboard-shell">
        <main className="dashboard-panel">
          <FilesTab
            files={files}
            loading={loading}
            error={error}
            uploading={uploading}
            processing={processing}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onUpload={uploadCandidateFiles}
            onRefresh={refreshFiles}
            onDelete={confirmDelete}
            onProcess={runProcessing}
          />
        </main>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

function FilesTab(props: {
  files: FileItem[];
  loading: boolean;
  error: string;
  uploading: boolean;
  processing: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpload: (files: File[]) => void;
  onRefresh: () => void;
  onDelete: (ids: string[]) => void;
  onProcess: (files: FileItem[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const allSelected = props.files.length > 0 && props.selectedIds.length === props.files.length;
  const selectedFiles = props.files.filter(file => props.selectedIds.includes(file.id));

  const openKnowledgeGraph = () => {
    window.open(`${graphUrl}?v=${Date.now()}`, '_blank', 'noopener,noreferrer');
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    props.onUpload(Array.from(event.dataTransfer.files));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onUpload(Array.from(event.target.files || []));
    event.target.value = '';
  };

  return (
    <section className="dashboard-section">
      <SectionHeader
        title="Tệp"
        subtitle="Tải lên các tệp nguồn và xử lý chúng bằng đường ống RAG mặc định."
        action={
          <div className="header-actions">
            <button className="dashboard-ghost-button" type="button" onClick={openKnowledgeGraph}>
              <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
              Đồ thị tri thức
            </button>
            <button className="dashboard-ghost-button" type="button" onClick={props.onRefresh}>
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              Làm mới
            </button>
          </div>
        }
      />

      <label
        className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedExtensions.join(',')}
          multiple
          onChange={handleChange}
          hidden
        />
        <span className="material-symbols-outlined plus-icon" aria-hidden="true">upload_file</span>
        <strong>{props.uploading ? 'Đang tải lên tệp...' : 'Kéo tệp vào đây hoặc chọn từ máy tính'}</strong>
        <small>Chấp nhận: DOCX, PDF, TXT, Markdown</small>
      </label>

      {props.error ? <div className="dashboard-alert">{props.error}</div> : null}

      <div className="table-toolbar">
        <div>{props.selectedIds.length} đã chọn</div>
        <div className="toolbar-actions">
          <button
            className="dashboard-primary-button"
            type="button"
            disabled={!selectedFiles.length || props.processing}
            onClick={() => props.onProcess(selectedFiles)}
            title="Xử lý với Vector và BM25, kích thước chunk 500, độ chồng lấn 50"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {props.processing ? 'progress_activity' : 'play_arrow'}
            </span>
            {props.processing ? 'Đang xử lý...' : 'Xử lý đã chọn'}
          </button>
          <button
            className="dashboard-danger-button"
            type="button"
            disabled={!props.selectedIds.length}
            onClick={() => props.onDelete(props.selectedIds)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
            Xóa đã chọn
          </button>
        </div>
      </div>

      {props.loading ? <LoadingState /> : null}
      {!props.loading && props.files.length === 0 ? (
        <EmptyState
          title="Chưa có tệp nguồn"
          description="Thêm tài liệu, sau đó xử lý chúng bằng Vector và BM25."
        />
      ) : null}

      {!props.loading && props.files.length > 0 ? (
        <div className="file-table-wrapper">
          <table className="file-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Chọn tất cả tệp"
                    type="checkbox"
                    checked={allSelected}
                    onChange={event => props.onSelect(event.target.checked ? props.files.map(file => file.id) : [])}
                  />
                </th>
                <th>Tên</th>
                <th>Loại</th>
                <th>Kích thước</th>
                <th>Trạng thái</th>
                <th>Đã tải lên</th>
                <th>Xử lý lần cuối</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {props.files.map(file => (
                <tr key={file.id}>
                  <td>
                    <input
                      aria-label={`Select ${file.name}`}
                      type="checkbox"
                      checked={props.selectedIds.includes(file.id)}
                      onChange={event => {
                        props.onSelect(
                          event.target.checked
                            ? [...props.selectedIds, file.id]
                            : props.selectedIds.filter(id => id !== file.id)
                        );
                      }}
                    />
                  </td>
                  <td className="file-name-cell">
                    <span className="material-symbols-outlined" aria-hidden="true">draft</span>
                    {file.name}
                  </td>
                  <td>{file.type.toUpperCase()}</td>
                  <td>{formatBytes(file.size)}</td>
                  <td><StatusPill status={file.status} /></td>
                  <td>{formatDate(file.uploadedAt)}</td>
                  <td>{formatDate(file.lastProcessedAt)}</td>
                  <td className="table-actions">
                    <button
                      className="dashboard-primary-button compact-action"
                      type="button"
                      disabled={props.processing || file.status === 'processing'}
                      onClick={() => props.onProcess([file])}
                      title="Xử lý với Vector và BM25, kích thước chunk 500, độ chồng lấn 50"
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                    </button>
                    <button className="icon-button danger" type="button" title="Xóa tệp" onClick={() => props.onDelete([file.id])}>
                      <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="dashboard-loading" aria-live="polite">
      <span />
      <span />
      <span />
    </div>
  );
}
