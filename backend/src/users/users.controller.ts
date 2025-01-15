import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: User })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, type: User })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: User })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string) {
    await this.usersService.deactivate(id);
  }

  @Post('verify-email/:token')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, type: User })
  verifyEmail(@Param('token') token: string) {
    return this.usersService.verifyEmail(token);
  }

  @Post('reset-password/initiate')
  @ApiOperation({ summary: 'Initiate password reset' })
  @ApiResponse({ status: 200 })
  initiatePasswordReset(@Body('email') email: string) {
    return this.usersService.initiatePasswordReset(email);
  }

  @Post('reset-password/complete')
  @ApiOperation({ summary: 'Complete password reset' })
  @ApiResponse({ status: 200, type: User })
  resetPassword(
    @Body('token') token: string,
    @Body('password') password: string,
  ) {
    return this.usersService.resetPassword(token, password);
  }
}
