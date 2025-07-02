// src/types/user.ts

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  TAILOR = 'TAILOR',
  CLIENT = 'CLIENT',
  GUEST = 'GUEST',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status?: 'active' | 'pending' | 'suspended' | 'inactive';
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
  // Add other user properties as needed
}