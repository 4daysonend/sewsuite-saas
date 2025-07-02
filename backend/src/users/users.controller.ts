import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  Module,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UserProfileService } from './services/user-profile.service';
import { UserRole } from './enums/user-role.enum';
import { UserRoleGuard } from './guards/user-role.guard';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UpdateEmailDto,
  UserPreferencesDto,
  QueryUsersDto,
} from './dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profileService: UserProfileService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(UserRoleGuard)
  @ApiOperation({ summary: 'Create user (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(UserRoleGuard)
  @ApiOperation({ summary: 'Query users (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  async findAll(@Query() queryDto: QueryUsersDto) {
    return this.usersService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  async updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.profileService.updateProfile(id, updateUserDto);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update password' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Password updated successfully',
  })
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    await this.usersService.updatePassword(id, updatePasswordDto);
  }

  @Patch(':id/email')
  @ApiOperation({ summary: 'Update email' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email updated successfully',
  })
  async updateEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmailDto: UpdateEmailDto,
  ) {
    return this.usersService.updateEmail(id, updateEmailDto);
  }

  @Patch(':id/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  async updatePreferences(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() preferences: Partial<UserPreferencesDto>,
  ) {
    return this.profileService.updatePreferences(id, preferences);
  }

  @Get(':id/quota')
  @ApiOperation({ summary: 'Get user storage quota' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Storage quota retrieved',
  })
  async getStorageQuota(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.getStorageQuota(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(UserRoleGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
  }
}
@Module({
  controllers: [UsersController],
  providers: [UsersService, UserProfileService],
})
export class UsersModule {}
