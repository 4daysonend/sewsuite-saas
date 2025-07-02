import express from 'express';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ServerStyleSheet } from 'styled-components';
import ssrPrepass from 'react-ssr-prepass';
import { SWRConfig } from 'swr';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { get } from '../lib/api';

// This would be a simplified example of SSR with React Router
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.resolve(__dirname, '../build')));

// Handle all routes
app.get('*', async (req, res) => {
  // Get initial data based on the route
  let initialData = {};
  
  try {
    // Parse the URL and match routes
    const url = req.originalUrl;
    
    // Example of prefetching data based on route
    if (url.startsWith('/orders')) {
      initialData.orders = await get('/orders');
    } else if (url.startsWith('/admin/users')) {
      const match = url.match(/\/admin\/users\/([^\/]+)\/edit/);
      if (match) {
        // User edit page
        initialData.user = await get(`/users/${match[1]}`);
      } else if (url.match(/\/admin\/users\/([^\/]+)$/)) {
        // User detail page
        const userId = url.match(/\/admin\/users\/([^\/]+)$/)[1];
        initialData.user = await get(`/users/${userId}`);
      } else {
        // Users list page
        initialData.users = await get('/users');
      }
    } else if (url === '/dashboard') {
      initialData.dashboard = await get('/admin/dashboard');
    }
  } catch (error) {
    console.error('Error prefetching data:', error);
    // Continue rendering with empty data
  }

  // Create a server style sheet
  const sheet = new ServerStyleSheet();
  
  try {
    const context = {};
    
    // App wrapped with providers
    const AppWithProviders = (
      <StaticRouter location={req.url} context={context}>
        <SWRConfig value={{ fallback: initialData }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SWRConfig>
      </StaticRouter>
    );
    
    // Run a single pass of data fetching
    await ssrPrepass(AppWithProviders);
    
    // Render to string
    const content = renderToString(sheet.collectStyles(AppWithProviders));
    
    // Get styles
    const styles = sheet.getStyleTags();
    
    // If there's a redirect
    if (context.url) {
      return res.redirect(301, context.url);
    }

    // Read the HTML file
    const indexFile = path.resolve('./build/index.html');
    fs.readFile(indexFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading index.html file:', err);
        return res.status(500).send('Oops, something went wrong!');
      }

      // Inject the rendered app and initial data
      const html = data
        .replace('<div id="root"></div>', `<div id="root">${content}</div>`)
        .replace('</head>', `${styles}</head>`)
        .replace(
          '<script id="__INITIAL_DATA__"></script>',
          `<script id="__INITIAL_DATA__">window.__INITIAL_DATA__ = ${JSON.stringify(initialData)}</script>`
        );

      return res.send(html);
    });
  } catch (error) {
    console.error('Error rendering app:', error);
    return res.status(500).send('Oops, something went wrong!');
  } finally {
    sheet.seal();
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});