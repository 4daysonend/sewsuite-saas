import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseEnumPipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UploadService } from '../services/upload.service';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ChunkUploadDto } from '../dto/chunk-upload.dto';
import { FileCategory, File, FileStatus } from '../entities/file.entity';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10485760); // 10MB default
    this.allowedMimeTypes = this.configService.get<string>('ALLOWED_MIME_TYPES', '').split(',');
  }

  @Post()
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        category: {
          enum: Object.values(FileCategory),
        },
        description: {
          type: 'string',
        },
        orderId: {
          type: 'string',
          format: 'uuid',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'File uploaded successfully',
    type: File
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: this.maxFileSize }),
          new FileTypeValidator({ fileType: this.allowedMimeTypes.join('|') }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @Req() req: Request,
  ) {
    return this.uploadService.uploadFile(file, uploadFileDto, req.user);
  }

  @Post('chunk')
  @ApiOperation({ summary: 'Upload a file chunk' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chunk: {
          type: 'string',
          format: 'binary',
        },
        fileId: {
          type: 'string',
          format: 'uuid',
        },
        chunkNumber: {
          type: 'integer',
          minimum: 0,
        },
        totalChunks: {
          type: 'integer',
          minimum: 1,
        },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chunk received successfully',
    schema: {
      properties: {
        received: { type: 'boolean' },
        chunksReceived: { type: 'integer' },
        totalChunks: { type: 'integer' }
      }
    }
  })
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @UploadedFile() chunk: Express.Multer.File,
    @Body() chunkUploadDto: ChunkUploadDto,
    @Req() req: Request,
  ) {
    return this.uploadService.handleChunkUpload(
      chunk,
      chunkUploadDto,
      req.user,
    );
  }

  @Post('complete/:fileId')
  @ApiOperation({ summary: 'Complete chunked upload' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'Chunked upload completed',
    type: File
  })
  async completeChunkedUpload(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req: Request,
  ) {
    return this.uploadService.completeChunkedUpload(fileId, req.user);
  }

  @Get('download/:fileId')
  @ApiOperation({ summary: 'Get file download URL' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'Download URL generated',
    schema: {
      properties: {
        url: { type: 'string', format: 'uri' },
        expiresAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getDownloadUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req: Request,
  ) {
    return this.uploadService.getDownloadUrl(fileId, req.user);
  }

  @Get('user-files')
  @ApiOperation({ summary: 'Get user files' })
  @ApiQuery({ name: 'category', enum: FileCategory, required: false })
  @ApiQuery({ name: 'page', type: 'integer', required: false })
  @ApiQuery({ name: 'limit', type: 'integer', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'User files retrieved',
    schema: {
      properties: {
        files: { 
          type: 'array',
          items: { $ref: '#/components/schemas/File' }
        },
        total: { type: 'integer' }
      }
    }
  })
  async getUserFiles(
    @Query('category') category?: FileCategory,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Req() req: Request,
  ) {
    return this.uploadService.getUserFiles(req.user, category, { page, limit });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get files for an order' })
  @ApiParam({ name: 'orderId', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order files retrieved',
    schema: {
      properties: {
        files: { 
          type: 'array',
          items: { $ref: '#/components/schemas/File' }
        },
        total: { type: 'integer' }
      }
    }
  })
  async getOrderFiles(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: Request,
  ) {
    return this.uploadService.getOrderFiles(orderId, req.user);
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete file' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  async deleteFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req: Request,
  ) {
    await this.uploadService.deleteFile(fileId, req.user);
    return { success: true };
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get user storage quota' })
  @ApiResponse({ 
    status: 200, 
    description: 'Storage quota retrieved',
    schema: {
      properties: {
        used: { type: 'integer' },
        total: { type: 'integer' },
        percentage: { type: 'number' },
        quotaByCategory: { 
          type: 'object',
          additionalProperties: { type: 'integer' }
        }
      }
    }
  })
  async getStorageQuota(@Req() req: Request) {
    return this.uploadService.getStorageQuota(req.user);
  }

  @Post('upload-multiple')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        category: {
          enum: Object.values(FileCategory),
        },
        orderId: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Files uploaded successfully',
    schema: {
      properties: {
        files: { 
          type: 'array',
          items: { $ref: '#/components/schemas/File' }
        },
        successCount: { type: 'integer' },
        failureCount: { type: 'integer' }
      }
    }
  })
  @UseInterceptors(FilesInterceptor('files', 10)) // max 10 files
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadFilesDto: UploadFileDto,
    @Req() req: Request,
  ) {
    return this.uploadService.uploadMultipleFiles(files, uploadFilesDto, req.user);
  }

  @Get(':fileId/status')
  @ApiOperation({ summary: 'Get file status' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: 200, 
    description: 'File status retrieved',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { enum: Object.values(FileStatus) },
        progress: { type: 'number' },
        error: { type: 'string' }
      }
    }
  })
  async getFileStatus(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req: Request,
  ) {
    return this.uploadService.getFileStatus(fileId, req.user);
  }
}