'use client';

import React, { createContext, useState, useContext, useEffect } from "react";
import { auth } from "../../firebase.config";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext<{login?: () => void; logout?: () => void; isAuthenticated: boolean; loading: boolean}>({ isAuthenticated: false, loading: true });

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = () => setIsAuthenticated(true);

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error: ", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
