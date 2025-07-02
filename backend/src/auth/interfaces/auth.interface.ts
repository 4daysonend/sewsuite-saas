import { UserRole } from '../../users/enums/user-role.enum';

// Add this type definition
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: Date;
  // Add any other properties needed for auth
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    createdAt: Date;
  };
}

export interface GoogleUser {
  email: string; // Email is required
  firstName?: string; // Make this optional
  lastName?: string; // Make this optional
  picture?: string; // Make this optional
  accessToken: string; // This is required
  refreshToken?: string; // This might be optional too
}
