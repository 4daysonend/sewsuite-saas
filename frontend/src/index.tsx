import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// Get the initial data that was injected into the HTML
const initialData = window.__INITIAL_DATA__ || {};

// Hydrate the app
hydrateRoot(
  document.getElementById('root'),
  <BrowserRouter>
    <SWRConfig value={{ 
      fallback: initialData,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // Refresh every 30 seconds
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
    }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SWRConfig>
  </BrowserRouter>
);

// Clear the server-rendered styles to avoid styling conflicts
const jssStyles = document.getElementById('jss-server-side');
if (jssStyles?.parentElement) {
  jssStyles.parentElement.removeChild(jssStyles);
}
