// /backend/src/orders/controllers/orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { Pagination, IPaginationMeta } from 'nestjs-typeorm-paginate';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer') // Base role - everyone with a customer role or higher can access
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  async createOrder(
    @Req() req: RequestWithUser,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Initiate payment for order' })
  @ApiResponse({ status: 200, description: 'Returns client secret for Stripe' })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  async initiatePayment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ clientSecret: string }> {
    return this.ordersService.initiatePayment(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, type: Order })
  @Roles('tailor', 'admin', 'superadmin') // Only tailors and above can update status
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Req() req: RequestWithUser,
  ): Promise<Order> {
    return this.ordersService.updateOrderStatus(
      id,
      updateOrderStatusDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  // The service will filter based on role - admins see all, others see their own
  async findAll(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('search') search?: string,
  ): Promise<Pagination<Order, IPaginationMeta>> {
    return this.ordersService.findAll({
      page,
      limit,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      userId: req.user.id,
      role: req.user.role,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  // The service handles permission checking based on ownership and role
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ): Promise<Order> {
    return this.ordersService.findOne(id, req.user.id, req.user.role);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, type: Order })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  // The service will check if user has right to cancel based on role and ownership
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: RequestWithUser,
  ): Promise<Order> {
    return this.ordersService.cancelOrder(
      id,
      reason,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get order history' })
  @Roles('customer', 'tailor', 'admin', 'superadmin')
  async getOrderHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.ordersService.getOrderHistory(id, req.user.id, req.user.role);
  }
}
