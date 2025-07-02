import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import { UserRole } from '../../types/user';

// Mock user data for different roles
const mockUsers = {
  admin: {
    id: '1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
  },
  tailor: {
    id: '2',
    email: 'tailor@example.com',
    firstName: 'Tailor',
    lastName: 'User',
    role: UserRole.TAILOR,
  },
  client: {
    id: '3',
    email: 'client@example.com',
    firstName: 'Client',
    lastName: 'User',
    role: UserRole.CLIENT,
  },
};

// Mock AuthContext for testing
const MockAuthProvider = ({ children, userRole }) => {
  const user = mockUsers[userRole] || null;
  
  return (
    <AuthProvider initialAuthState={{
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    }}>
      {children}
    </AuthProvider>
  );
};

// Render component with specific role
export const renderWithRole = (ui, role = 'client') => {
  return render(
    <BrowserRouter>
      <MockAuthProvider userRole={role}>
        {ui}
      </MockAuthProvider>
    </BrowserRouter>
  );
};