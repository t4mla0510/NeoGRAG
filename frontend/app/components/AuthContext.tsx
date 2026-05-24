'use client';

import React, { createContext, useContext, useEffect, useState } from "react";

type AdminUser = {
  id: number;
  email: string;
  username: string;
};

type AuthContextValue = {
  user: AdminUser | null;
  token: string | null;
  login?: (email: string, password: string) => Promise<void>;
  logout?: () => void;
  isAuthenticated: boolean;
  loading: boolean;
};

const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const API_BASE = configuredApiBase.includes("://backend:") ? "" : configuredApiBase;
const TOKEN_KEY = "neograg_admin_token";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const admin = (await response.json()) as AdminUser;
        setUser(admin);
        setToken(savedToken);
        setIsAuthenticated(true);
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail || "Invalid email or password");
    }

    const accessToken = payload.access_token as string;
    window.localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);

    const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meResponse.ok) {
      throw new Error("Unable to load admin profile");
    }

    const admin = (await meResponse.json()) as AdminUser;
    setUser(admin);
    setIsAuthenticated(true);
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
