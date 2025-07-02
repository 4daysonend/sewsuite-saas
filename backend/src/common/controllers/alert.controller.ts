import {
  Controller,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AlertService,
  AlertCategory,
  AlertSeverity,
} from '../services/alert.service';
import { CurrentUser as User } from '../../common/decorators/user.decorator';

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get active alerts' })
  @ApiResponse({ status: 200, description: 'Returns active alerts' })
  async getActiveAlerts(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.alertService.getActiveAlerts(page, limit);
  }

  @Get('summary')
  @Roles('admin')
  @ApiOperation({ summary: 'Get alert summary statistics' })
  @ApiResponse({ status: 200, description: 'Returns alert summary' })
  async getAlertSummary() {
    return this.alertService.getAlertSummary();
  }

  @Get('category/:category')
  @Roles('admin')
  @ApiOperation({ summary: 'Get alerts by category' })
  @ApiResponse({ status: 200, description: 'Returns alerts by category' })
  async getAlertsByCategory(
    @Param('category') category: AlertCategory,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.alertService.getAlertsByCategory(category, page, limit);
  }

  @Get('severity/:severity')
  @Roles('admin')
  @ApiOperation({ summary: 'Get alerts by severity' })
  @ApiResponse({ status: 200, description: 'Returns alerts by severity' })
  async getAlertsBySeverity(
    @Param('severity') severity: AlertSeverity,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.alertService.getAlertsBySeverity(severity, page, limit);
  }

  @Get('user/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Get alerts by user ID' })
  @ApiResponse({ status: 200, description: 'Returns alerts by user ID' })
  async getAlertsByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.alertService.getAlertsByUserId(userId, page, limit);
  }

  @Put(':alertId/resolve')
  @Roles('admin')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved' })
  async resolveAlert(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() body: { details?: Record<string, any> },
    @User() user: any,
  ) {
    return this.alertService.resolveAlert(alertId, user.id, body.details);
  }
}
