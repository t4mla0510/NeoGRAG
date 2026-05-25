'use client';

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./Auth.css";
import { assets } from "../components/assets";
import { useAuth } from "../components/AuthContext";

export default function Auth() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/upload");
    }
  }, [isAuthenticated, router]);

  if (loading || isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace("/upload");
    } catch (err) {
      console.error("Login error: ", err);
      setError("Email hoặc mật khẩu đăng nhập không đúng!");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <Link href="/" className="auth-back-button">
        <span className="material-symbols-outlined">arrow_back</span>
        Quay lại trang chủ
      </Link>
      <div className="auth-box">
        <Image src={assets.ctu} alt="Logo" className="auth-logo" width={330} height={120} priority />

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <span className="material-symbols-outlined">mail</span>
            <input
              type="email"
              placeholder="Email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-input-group">
            <span className="material-symbols-outlined">lock</span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Mật khẩu"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="material-symbols-outlined auth-visibility-button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "visibility_off" : "visibility"}
            </button>
          </div>

          {error && (
            <p style={{ color: "red", fontSize: "17px", marginBottom: "10px" }}>
              {error}
            </p>
          )}

          <div className="auth-options">
            <a href="#">Quên Mật Khẩu?</a>
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? "Đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
