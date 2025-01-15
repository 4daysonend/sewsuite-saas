import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UploadService } from '../services/upload.service';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ChunkUploadDto } from '../dto/chunk-upload.dto';
import { File } from '../entities/file.entity';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @Req() req,
  ): Promise<File> {
    return this.uploadService.uploadFile(file, uploadFileDto, req.user);
  }

  @Post('chunk')
  @ApiOperation({ summary: 'Upload a file chunk' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @UploadedFile() chunk: Express.Multer.File,
    @Body() chunkUploadDto: ChunkUploadDto,
    @Req() req,
  ): Promise<{ received: boolean }> {
    return this.uploadService.handleChunkUpload(
      chunk,
      chunkUploadDto,
      req.user,
    );
  }

  @Post('complete/:fileId')
  @ApiOperation({ summary: 'Complete chunked upload' })
  async completeChunkedUpload(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req,
  ): Promise<File> {
    return this.uploadService.completeChunkedUpload(fileId, req.user);
  }

  @Get('download/:fileId')
  @ApiOperation({ summary: 'Get file download URL' })
  async getDownloadUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req,
  ): Promise<{ url: string }> {
    return this.uploadService.getDownloadUrl(fileId, req.user);
  }

  @Get('user-files')
  @ApiOperation({ summary: 'Get user files' })
  async getUserFiles(
    @Query('category') category: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req,
  ): Promise<{ files: File[]; total: number }> {
    return this.uploadService.getUserFiles(req.user, category, { page, limit });
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete file' })
  async deleteFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req,
  ): Promise<void> {
    return this.uploadService.deleteFile(fileId, req.user);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get user storage quota' })
  async getStorageQuota(@Req() req): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    return this.uploadService.getStorageQuota(req.user);
  }
}
