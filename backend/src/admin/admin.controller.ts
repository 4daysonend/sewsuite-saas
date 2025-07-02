import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  Param,
  Delete,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply both guards at controller level
@Roles('admin') // Require admin role for all routes in this controller
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Admin dashboard data retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  getDashboard() {
    this.logger.log('Admin accessing dashboard');
    return {
      status: 'success',
      message: 'Admin dashboard data',
      stats: {
        users: 1250,
        orders: 458,
        revenue: '$12,450.00',
        activeSubscriptions: 342,
      },
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  getAllUsers() {
    return {
      status: 'success',
      message: 'Users list retrieved',
      users: [
        { id: 1, email: 'user1@example.com', role: 'user' },
        { id: 2, email: 'admin@example.com', role: 'admin' },
      ],
    };
  }

  @Post('system-settings')
  @ApiOperation({ summary: 'Update system settings' })
  @Roles('superadmin') // Override with more restrictive role for this specific endpoint
  updateSystemSettings(@Body() settings: any) {
    this.logger.log('Superadmin updating system settings', { settings });
    return {
      status: 'success',
      message: 'System settings updated',
    };
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  deleteUser(@Param('id') id: string) {
    this.logger.log(`Admin deleting user with ID: ${id}`);
    return {
      status: 'success',
      message: `User ${id} deleted successfully`,
    };
  }
}
