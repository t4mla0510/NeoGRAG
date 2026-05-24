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

type DashboardTab = 'files' | 'graph';

const defaultChunkSize = 500;
const defaultChunkOverlap = 50;

export default function Upload() {
  const router = useRouter();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('files');
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
      setError(err instanceof Error ? err.message : 'Unable to load files');
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
      toast.error(`Unsupported file type: ${rejected.join(', ')}`);
    }

    if (!valid.length) return;

    setUploading(true);
    try {
      await uploadFiles(valid);
      toast.success('Files uploaded successfully');
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async (ids: string[]) => {
    if (!ids.length) return;
    const label = ids.length === 1 ? 'this file' : `${ids.length} files`;
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;

    try {
      if (ids.length === 1) {
        await deleteFile(ids[0]);
      } else {
        await deleteFiles(ids);
      }
      toast.success('Deleted successfully');
      setSelectedIds(current => current.filter(id => !ids.includes(id)));
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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
      toast.success('Processed with Vector and BM25');
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Processing failed');
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
        <button className="dashboard-ghost-button" type="button" onClick={handleLogout} aria-label="Log out">
          <span className="material-symbols-outlined" aria-hidden="true">logout</span>
        </button>
      </header>

      <div className="dashboard-shell">
        <DashboardSidebar activeTab={activeTab} onChange={setActiveTab} />

        <main className="dashboard-panel">
          {activeTab === 'files' ? (
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
          ) : null}

          {activeTab === 'graph' ? <KnowledgeGraphTab /> : null}
        </main>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

function DashboardSidebar({
  activeTab,
  onChange,
}: {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}) {
  const tabs: { id: DashboardTab; label: string; icon: string }[] = [
    { id: 'files', label: 'Files', icon: 'folder_open' },
    { id: 'graph', label: 'Knowledge Graph', icon: 'account_tree' },
  ];

  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard sections">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </aside>
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
        title="Files"
        subtitle="Upload source files and process them with the default RAG pipeline."
        action={
          <button className="dashboard-ghost-button" type="button" onClick={props.onRefresh}>
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            Refresh
          </button>
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
        <strong>{props.uploading ? 'Uploading files...' : 'Drag files here or choose from your computer'}</strong>
        <small>Accepted: DOCX, PDF, TXT, Markdown</small>
      </label>

      {props.error ? <div className="dashboard-alert">{props.error}</div> : null}

      <div className="table-toolbar">
        <div>{props.selectedIds.length} selected</div>
        <div className="toolbar-actions">
          <button
            className="dashboard-primary-button"
            type="button"
            disabled={!selectedFiles.length || props.processing}
            onClick={() => props.onProcess(selectedFiles)}
            title="Process with Vector and BM25, chunk size 500, overlap 50"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {props.processing ? 'progress_activity' : 'play_arrow'}
            </span>
            {props.processing ? 'Processing...' : 'Process selected'}
          </button>
          <button
            className="dashboard-danger-button"
            type="button"
            disabled={!props.selectedIds.length}
            onClick={() => props.onDelete(props.selectedIds)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
            Delete selected
          </button>
        </div>
      </div>

      {props.loading ? <LoadingState /> : null}
      {!props.loading && props.files.length === 0 ? (
        <EmptyState
          title="No source files yet"
          description="Add documents, then process them with Vector and BM25."
          action={
            <button className="dashboard-primary-button" type="button" onClick={() => fileInputRef.current?.click()}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Add files
            </button>
          }
        />
      ) : null}

      {!props.loading && props.files.length > 0 ? (
        <div className="file-table-wrapper">
          <table className="file-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select all files"
                    type="checkbox"
                    checked={allSelected}
                    onChange={event => props.onSelect(event.target.checked ? props.files.map(file => file.id) : [])}
                  />
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>Last processed</th>
                <th>Actions</th>
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
                      title="Process with Vector and BM25, chunk size 500, overlap 50"
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                    </button>
                    <button className="icon-button danger" type="button" title="Delete file" onClick={() => props.onDelete([file.id])}>
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

function KnowledgeGraphTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetch(graphUrl, { method: 'HEAD' })
      .then(response => {
        if (!active) return;
        setFailed(!response.ok);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section className="dashboard-section">
      <SectionHeader
        title="Knowledge Graph"
        subtitle="View the generated academic regulation knowledge graph."
        action={
          <div className="header-actions">
            <button
              className="dashboard-ghost-button"
              type="button"
              onClick={() => {
                setFailed(false);
                setLoading(true);
                setReloadKey(key => key + 1);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              Refresh
            </button>
            <a className="dashboard-ghost-button" href={graphUrl} target="_blank" rel="noreferrer">
              <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
              Open
            </a>
          </div>
        }
      />

      <div className="graph-viewer">
        {loading ? <div className="graph-overlay"><LoadingState /></div> : null}
        {failed ? (
          <EmptyState
            title="Graph unavailable"
            description="The backend could not load backend/data/graphify-out/academic_regulation.graph.html."
          />
        ) : (
          <iframe
            key={reloadKey}
            title="Academic regulation knowledge graph"
            src={`${graphUrl}?v=${reloadKey}`}
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
        )}
      </div>
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
