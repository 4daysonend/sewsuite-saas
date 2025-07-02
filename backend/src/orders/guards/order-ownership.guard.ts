import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { OrdersService } from '../orders.service';

@Injectable()
export class OrderOwnershipGuard implements CanActivate {
  constructor(private ordersService: OrdersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orderId = request.params.id;

    if (!user || !orderId) {
      return false;
    }

    try {
      // Check if user has access to this order
      const order = await this.ordersService.findOne(orderId);
      // Verify the order belongs to this user or user has appropriate role
      return !!order && (order.client?.id === user.id || user.role === 'admin');
    } catch {
      return false;
    }
  }
}
