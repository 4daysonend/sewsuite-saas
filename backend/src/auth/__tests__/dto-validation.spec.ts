import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

describe('Auth DTOs Validation', () => {
  describe('RegisterDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToClass(RegisterDto, {
        email: 'test@example.com',
        password: 'StrongPass123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email format', async () => {
      const dto = plainToClass(RegisterDto, {
        email: 'not-an-email',
        password: 'StrongPass123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail with weak password', async () => {
      const dto = plainToClass(RegisterDto, {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('should fail with missing required fields', async () => {
      const dto = plainToClass(RegisterDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2); // At least email and password are required
    });

    it('should normalize email with trimming and lowercase', async () => {
      const dto = plainToClass(RegisterDto, {
        email: '  Test@Example.COM  ',
        password: 'StrongPass123!',
      });

      // Assuming you have a transform decorator on email that normalizes it
      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('LoginDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with missing email', async () => {
      const dto = plainToClass(LoginDto, {
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail with missing password', async () => {
      const dto = plainToClass(LoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });
  });
});
