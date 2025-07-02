import { Request } from 'express';

export interface RequestWithUser extends Omit<Request, 'user'> {
  user: {
    id: string;
    role: string;
    [key: string]: any; // For any other properties the user object might have
  };
}
