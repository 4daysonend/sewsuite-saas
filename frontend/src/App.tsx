// sewsuite-saas\frontend\src\App.tsx (updated)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Auth components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Layout
import Layout from './components/layout/Layout';

// Dashboard and User components
import Dashboard from './components/Dashboard';
import UserProfile from './components/UserProfile';
import UserManagementDashboard from './components/user/UserManagementDashboard';
import SystemHealthDashboard from './components/SystemHealthDashboard';

// Error and utility pages
import NotFound from './components/common/NotFound';
import Unauthorized from './components/common/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/not-found" element={<NotFound />} />
          
          {/* Protected routes with layout */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Layout>
                  <UserProfile />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          {/* Admin only routes */}
          <Route 
            path="/admin/users" 
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <UserManagementDashboard />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin/system-health" 
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <SystemHealthDashboard />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect to dashboard if authenticated, otherwise to login */}
          <Route 
            path="/" 
            element={
              localStorage.getItem('token') ? 
                <Navigate to="/dashboard" replace /> : 
                <Navigate to="/login" replace />
            } 
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;