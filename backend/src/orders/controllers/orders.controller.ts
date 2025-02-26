// /backend/src/orders/controllers/orders.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
  Req,
  Put,
  Query,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrdersService } from '../orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { Pagination } from '../../common/interfaces/pagination.interface';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, type: Order })
  async createOrder(
    @Req() req,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Initiate payment for order' })
  @ApiResponse({ status: 200, description: 'Returns client secret for Stripe' })
  async initiatePayment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ clientSecret: string }> {
    return this.ordersService.initiatePayment(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, type: Order })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Req() req,
  ): Promise<Order> {
    return this.ordersService.updateOrderStatus(id, updateOrderStatusDto);
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
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('search') search?: string,
    @Req() req,
  ): Promise<Pagination<Order>> {
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
  @ApiResponse({ status: 200, type: Order })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
  ): Promise<Order> {
    return this.ordersService.findOne(id, req.user.id, req.user.role);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, type: Order })
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req,
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
  @ApiResponse({ status: 200, description: 'Order history' })
  async getOrderHistory(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.ordersService.getOrderHistory(id, req.user.id, req.user.role);
  }
}