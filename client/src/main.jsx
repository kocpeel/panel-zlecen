import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { isDemo } from './api/index.js';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import './styles.css';

// The demo runs from a single file, possibly in a frame, so it cannot rely on URL paths.
const Router = isDemo ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
