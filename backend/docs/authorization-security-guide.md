# Authorization Security Guide

## Role-Based Access Control

This document provides guidelines for implementing secure role-based authorization in the SewSuite SaaS application. Following these practices is critical to prevent unauthorized access to sensitive functionality.

## Core Components

### 1. RolesGuard

The `RolesGuard` is the primary mechanism for enforcing role-based access control:

- Integrates with JWT authentication to extract user roles
- Validates roles against endpoint requirements
- Provides detailed security logging 
- Handles various error conditions securely

### 2. Roles Decorator

The `@Roles()` decorator is used to specify which roles can access a particular endpoint:

```typescript
@Roles('admin', 'superadmin')
```

## Implementation Guidelines

### 1. Always Use Both Guards Together

JWT authentication and role verification should always be used together:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
```

### 2. Define Roles at Controller or Method Level

You can define roles at controller level for all endpoints:

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController { ... }
```

Or at method level for specific endpoints:

```typescript
@Post('system-settings')
@Roles('superadmin')
updateSystemSettings() { ... }
```

### 3. Role Hierarchy Best Practices

- `user` - Basic user access
- `manager` - Team/organization management
- `admin` - Admin-level system configuration
- `superadmin` - Critical system settings

### 4. Security Testing

Always include security tests for your endpoints:

- Test positive cases (authorized access)
- Test negative cases (unauthorized access)
- Test edge cases (expired tokens, malformed claims)

## Security Audit

The `AuthorizationService` performs automatic security scanning at application startup to ensure:

1. All admin routes are properly protected
2. Role definitions are consistent
3. No security vulnerabilities exist in the authorization chain

## Common Vulnerabilities to Avoid

1. **Missing Guards**: Always apply both JWT and Roles guards
2. **Overly Permissive Roles**: Use the principle of least privilege
3. **Inconsistent Role Naming**: Stick to the defined role hierarchy
4. **Bypassing Middleware**: Don't create alternative routes that bypass guards

## Example Implementation

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard) 
@Roles('admin')
export class AdminController {
  @Get('users')
  getAllUsers() {
    // Only accessible to admins
  }
  
  @Post('system-settings')
  @Roles('superadmin') // Override with more restrictive role
  updateSystemSettings() {
    // Only accessible to superadmins
  }
}
```

## Best Practices for Front-end Integration

1. Store user roles in secure storage
2. Conditionally render UI elements based on roles
3. Handle 401/403 responses properly
4. Always validate again on the server side regardless of UI restrictions