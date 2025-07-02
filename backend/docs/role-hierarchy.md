# Role Hierarchy Documentation

This document outlines the role hierarchy used within Sew Suite SaaS, establishing the permissions and access levels for different user types. This hierarchy should be consistently applied across the application to ensure proper authorization controls.

## Role Levels (Highest to Lowest)

1. **superadmin**
   - Full system access
   - Can perform system-level configurations and operations
   - Can manage all other user types including admins
   - Can access sensitive system settings and monitoring tools

2. **admin**
   - Full application access except for system-level settings
   - Can manage users, products, orders, and payments
   - Can view analytics and reports
   - Cannot modify system configurations or access dev tools

3. **tailor**
   - Business account with product management capabilities
   - Can create and manage their own products and services
   - Can view and manage their own orders
   - Limited access to analytics (only for their own data)

4. **customer**
   - Standard user account with ordering capabilities
   - Can manage their profile and orders
   - Can make purchases and manage subscriptions
   - Cannot access admin features or backend functionality

5. **guest**
   - Unauthenticated user
   - Can view public information
   - Can register for an account
   - Limited access to public API endpoints

## Access Control Matrix

| Resource/Action          | superadmin | admin | tailor | customer | guest |
|--------------------------|:----------:|:-----:|:------:|:--------:|:-----:|
| View public content      | ✅         | ✅    | ✅     | ✅       | ✅    |
| View/Edit own profile    | ✅         | ✅    | ✅     | ✅       | ❌    |
| Create/Edit own products | ✅         | ✅    | ✅     | ❌       | ❌    |
| Edit any product         | ✅         | ✅    | ❌     | ❌       | ❌    |
| View orders              | ✅ (all)   | ✅ (all) | ✅ (own) | ✅ (own) | ❌    |
| Process payments         | ✅         | ✅    | ❌     | ❌       | ❌    |
| Issue refunds            | ✅         | ✅    | ❌     | ❌       | ❌    |
| View analytics           | ✅ (full)  | ✅ (full) | ✅ (own) | ❌       | ❌    |
| Manage users             | ✅ (all)   | ✅ (non-admin) | ❌     | ❌       | ❌    |
| System configuration     | ✅         | ❌    | ❌     | ❌       | ❌    |

## Implementation Guidelines

### Controller-Level Protection

For controllers that manage sensitive resources or admin functionality, apply role guards at the controller level:

```typescript
@Controller('admin/resource')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AdminResourceController {
  // All methods will require admin or superadmin roles
}
```

### Method-Level Protection

For controllers with mixed access patterns, apply role guards at the method level:

```typescript
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  @Get()
  // Public endpoint - no @Roles decorator needed
  findAll() { ... }

  @Post()
  @Roles('admin', 'tailor')
  create() { ... }

  @Put(':id')
  @Roles('admin', 'tailor')
  update() { ... }
}
```

### Role Inheritance

In our authorization system, roles do not automatically inherit permissions from lower roles. Each required role must be explicitly specified in the `@Roles()` decorator.

For example, to allow both admins and tailors to access an endpoint:

```typescript
@Roles('admin', 'tailor')
```

### Security Best Practices

1. Always apply both `JwtAuthGuard` and `RolesGuard`
2. Prefer controller-level guards over method-level when all endpoints have the same requirements
3. Use method-level role decorators to override controller-level roles when needed
4. For public endpoints in otherwise protected controllers, use an empty roles array: `@Roles()`