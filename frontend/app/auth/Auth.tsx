'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase.config";
import "./Auth.css";
import { assets } from "../components/assets";
import { useAuth } from "../components/AuthContext";

export default function Auth() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/upload");
    }
  }, [isAuthenticated, router]);

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      login();
      router.replace("/upload");
    } catch (err) {
      console.error("Login error: ", err);
      setError("Email hoặc mật khẩu không đúng!");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <img src={assets.ctu} alt="Logo" className="auth-logo" />

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <span className="material-symbols-outlined">mail</span>
            <input
              type="email"
              placeholder="Email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            />
            <span
              className="material-symbols-outlined"
              onClick={() => setShowPassword(!showPassword)}
              style={{ cursor: "pointer" }}
            >
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </div>

          {error && (
            <p style={{ color: "red", fontSize: "17px", marginBottom: "10px" }}>
              {error}
            </p>
          )}

          <div className="auth-options">
            <a href="#">Quên mật khẩu?</a>
          </div>

          <button type="submit" className="auth-button">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}
