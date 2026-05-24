'use client';

import React, { useState } from "react";
import "./Upload.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthContext";

export default function Upload() {
  const router = useRouter();
  const { logout } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  }

  const handleFileChange = (e) => {
    setFiles([...files, ...Array.from(e.target.files)]);
  };

  const handleRemove = (index) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const uploadRes = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.detail || "Upload failed");
      }

      const trainRes = await fetch("/train", {
        method: "POST",
      });

      const trainData = await trainRes.json();

      if (!trainRes.ok) {
        throw new Error(trainData.detail || "Training failed");
      }

      toast.success(
        `Tệp đã được tải lên và huấn luyện thành công!`
      );
      setFiles([]);
    } catch (err) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <button className="btn-logout" onClick={handleLogout}>
        Đăng xuất
      </button>
      <div className="upload-container">
        <h2 className="upload-title">Hệ thống Quản lý tài liệu REBot</h2>

        <label className="upload-dropzone">
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            hidden
          />
          <div className="dropzone-content">
            <span className="material-symbols-outlined plus-icon">add_2</span>
            <p>Kéo & thả hoặc bấm để chọn file</p>
            <small>Dung lượng tối đa: 10MB</small>
          </div>
        </label>

        {/* File List */}
        {files.length > 0 && (
          <div className="file-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="material-symbols-outlined">draft</span>
                  <div>
                    <p className="file-name">{file.name}</p>
                    <small className="file-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </small>
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleRemove(index)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <button
            className="btn-upload"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Đang xử lý..." : "Tải lên"}
          </button>
        )}

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </div>
  );
}
