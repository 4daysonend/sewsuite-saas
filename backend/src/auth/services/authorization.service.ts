import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Scan the application for controllers and endpoints with role-based security
   * to validate that sensitive routes are properly protected
   */
  public validateSecurityConfiguration(): void {
    const controllers = this.discoveryService.getControllers();
    let adminRoutesCount = 0;
    let unprotectedAdminRoutesCount = 0;

    this.logger.log(
      `Scanning ${controllers.length} controllers for authorization configuration...`,
    );

    for (const controller of controllers) {
      // Get controller instance and metadata
      const instance = controller.instance;
      const controllerRoles = this.reflector.get(
        ROLES_KEY,
        controller.metatype,
      );
      const isControllerProtected = !!controllerRoles;

      // Log controller protection status
      this.logger.debug(
        `Controller: ${controller.name} - ${
          isControllerProtected
            ? `Protected with roles: [${controllerRoles}]`
            : 'No controller-level protection'
        }`,
      );

      // Skip if controller has no methods (shouldn't happen)
      if (!instance) continue;

      // Get all methods of the controller
      const methodNames = this.getControllerMethods(instance);

      for (const methodName of methodNames) {
        const method = instance[methodName];

        // Skip if not a controller method
        if (typeof method !== 'function') continue;

        // Get method roles
        const methodRoles = this.reflector.get(ROLES_KEY, method);
        const effectiveRoles = methodRoles || controllerRoles;

        // Check if this is an admin route
        const isAdminRoute = this.isAdminRoute(controller, methodName);

        if (isAdminRoute) {
          adminRoutesCount++;

          // Check if route is properly protected
          const hasAdminProtection =
            effectiveRoles &&
            (effectiveRoles.includes('admin') ||
              effectiveRoles.includes('superadmin'));

          if (!hasAdminProtection) {
            unprotectedAdminRoutesCount++;
            this.logger.warn(
              `⚠️ SECURITY RISK: Admin route ${controller.name}.${methodName} is NOT protected with admin role!`,
            );
          }
        }

        // Log method protection
        this.logger.debug(
          `  Method: ${methodName} - ${
            effectiveRoles
              ? `Protected with roles: [${effectiveRoles}]`
              : 'No protection'
          }`,
        );
      }
    }

    // Log summary of findings
    if (unprotectedAdminRoutesCount > 0) {
      this.logger.warn(
        `⚠️ SECURITY VULNERABILITY: Found ${unprotectedAdminRoutesCount} out of ${adminRoutesCount} admin routes without proper role protection!`,
      );
    } else {
      this.logger.log(
        `✅ All ${adminRoutesCount} admin routes are properly protected with role-based authorization.`,
      );
    }
  }

  /**
   * Gets all methods from a controller instance
   */
  private getControllerMethods(instance: any): string[] {
    // Get all property names excluding those from Object.prototype
    const propertyNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(instance),
    );
    // Filter out the constructor
    return propertyNames.filter((name) => name !== 'constructor');
  }

  /**
   * Determines if a route is an admin route based on naming conventions
   */
  private isAdminRoute(controller: any, methodName: string): boolean {
    // Check controller name for admin indicators
    const controllerName = controller.name.toLowerCase();

    if (
      controllerName.includes('admin') ||
      controllerName.startsWith('admin')
    ) {
      return true;
    }

    // Check method name for admin indicators
    if (methodName.toLowerCase().includes('admin')) {
      return true;
    }

    // Check path for admin indicators if available
    const path = Reflect.getMetadata('path', controller.metatype) || '';

    if (
      path.toString().toLowerCase().includes('admin') ||
      path.toString().startsWith('/admin')
    ) {
      return true;
    }

    return false;
  }
}
