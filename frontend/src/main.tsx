import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './core/context/ThemeContext';
import { QueryProvider } from './core/query/query-provider';
import { Toaster } from './components/ui/sonner';
import './index.css';
import { installTenantHeaderFetch } from './core/config/app-config';

// Staging (path routing): add the active chamber header to API calls. No-op otherwise.
installTenantHeaderFetch();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <ThemeProvider>
        <App />
        {/* Renders every `toast()` from sonner (success / error feedback across the app). */}
        <Toaster />
      </ThemeProvider>
    </QueryProvider>
  </React.StrictMode>
);
