// sewsuite-saas\frontend\src\App.tsx (updated)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UserRole } from './types/user';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import OAuthCallback from './components/auth/OAuthCallback';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Public pages
import Unauthorized from './components/common/Unauthorized';
import NotFound from './components/common/NotFound';
import HomePage from './components/home/HomePage';

// User dashboard pages
import Dashboard from './components/dashboard/Dashboard';
import OrdersList from './components/orders/OrdersList';
import OrderDetail from './components/orders/OrderDetail';
import FilesList from './components/files/FilesList';
import UserProfile from './components/account/UserProfile';
import AccountSettings from './components/account/AccountSettings';

// Tailor-specific pages
import Projects from './components/projects/Projects';
import Measurements from './components/measurements/Measurements';
import Templates from './components/templates/Templates';
import Calendar from './components/calendar/Calendar';

// Admin pages
import UserManagement from './components/admin/UserManagement';
import SystemMonitoring from './components/admin/SystemMonitoring';
import AdminAnalytics from './components/admin/AdminAnalytics';
import Reports from './components/admin/Reports';
import PaymentManagement from './components/admin/PaymentManagement';
import AdminSettings from './components/admin/AdminSettings';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/home" element={<HomePage />} />
          
          {/* Application routes with layout */}
          <Route element={<AppLayout />}>
            {/* Dashboard and common features - accessible by all authenticated users */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <OrdersList />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/orders/:id" 
              element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/files" 
              element={
                <ProtectedRoute>
                  <FilesList />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <AccountSettings />
                </ProtectedRoute>
              } 
            />
            
            {/* Tailor-specific routes */}
            <Route 
              path="/projects" 
              element={
                <ProtectedRoute requiredRoles={UserRole.TAILOR}>
                  <Projects />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/measurements" 
              element={
                <ProtectedRoute>
                  <Measurements />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/templates" 
              element={
                <ProtectedRoute requiredRoles={UserRole.TAILOR}>
                  <Templates />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/calendar" 
              element={
                <ProtectedRoute requiredRoles={UserRole.TAILOR}>
                  <Calendar />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin routes */}
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requiredRoles={UserRole.ADMIN}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/monitoring" 
              element={
                <ProtectedRoute requiredRoles={UserRole.ADMIN}>
                  <SystemMonitoring />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute requiredRoles={UserRole.ADMIN}>
                  <AdminAnalytics />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/reports" 
              element={
                <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.TAILOR]}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/payments" 
              element={
                <ProtectedRoute requiredRoles={UserRole.ADMIN}>
                  <PaymentManagement />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute requiredRoles={UserRole.ADMIN}>
                  <AdminSettings />
                </ProtectedRoute>
              } 
            />
          </Route>
          
          {/* Default route - redirect to home or dashboard based on authentication */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Not found route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;