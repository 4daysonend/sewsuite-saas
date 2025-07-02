export class CreateUserDto {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  googleId?: string;
}
