import { UserRole } from '../../users/entities/user.entity';

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
    fullName?: string;
    role: UserRole;
    createdAt: Date;
  };
}

export interface GoogleUser {
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
}
