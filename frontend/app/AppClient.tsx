'use client';

import React, { useEffect } from 'react';
import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './components/AuthContext';

const AppClient = ({ children }) => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('webfontloader').then((WebFont) => {
        WebFont.load({
          google: {
            families: [
              'K2D:vietnamese',
              'Readex Pro:vietnamese'
            ]
          }
        });
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
};

export default AppClient;
