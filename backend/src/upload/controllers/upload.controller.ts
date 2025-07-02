import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UploadService } from '../services/upload.service';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ChunkUploadDto } from '../dto/chunk-upload.dto';
import { FileCategory, File } from '../entities/file.entity';
import { User } from '../../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { FileUploadResultDto } from '../dto/file-upload-result.dto';
import { ChunkUploadResultDto } from '../dto/chunk-upload-result.dto';
import { DownloadUrlResultDto } from '../dto/download-url-result.dto';
import { FileStatusResultDto } from '../dto/file-status-result.dto';
import { StorageQuotaResultDto } from '../dto/storage-quota-result.dto';
import { MultipleFilesResultDto } from '../dto/multiple-files-result.dto';
import { FileService } from '../services/file.service';
import { GetFilesFilterDto } from '../dto/get-files-filter.dto';
import { ValidatedFile } from '../decorators/validated-file.decorator';
import { Express } from 'express'; // Built-in Express type

@ApiTags('upload')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadController {
  private readonly _maxFileSize: number;
  private readonly _allowedMimeTypes: string[];

  // Add a getter with safe fallback
  get maxFileSize(): number {
    return this._maxFileSize || 10485760; // Default 10MB
  }

  // Add a getter that will be recognized as usage
  get allowedMimeTypes(): string[] {
    return this._allowedMimeTypes;
  }

  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
    private readonly fileService: FileService,
  ) {
    // Initialize in constructor
    const configFileSize = this.configService.get<string | number>(
      'MAX_FILE_SIZE',
      10485760,
    );
    this._maxFileSize =
      typeof configFileSize === 'string'
        ? parseInt(configFileSize, 10) || 10485760
        : configFileSize ?? 10485760;

    // Initialize _allowedMimeTypes
    this._allowedMimeTypes = this.configService.get<string[]>(
      'ALLOWED_MIME_TYPES',
      ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    );
  }

  // Add these static methods
  private static getMaxFileSize(configService?: ConfigService): number {
    if (configService) {
      const configFileSize = configService.get<string | number>(
        'MAX_FILE_SIZE',
        10485760,
      );
      return typeof configFileSize === 'string'
        ? parseInt(configFileSize, 10) || 10485760
        : configFileSize ?? 10485760;
    }
    return 10485760; // Default fallback
  }

  private static getAllowedMimeTypes(): string[] {
    return ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
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
    type: FileUploadResultDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @ValidatedFile({
      maxSize: UploadController.getMaxFileSize(),
      mimeTypes: UploadController.getAllowedMimeTypes(),
    })
    file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @CurrentUser() user: User,
  ) {
    const uploadResult = await this.uploadService.uploadFile(
      file,
      uploadFileDto,
      user,
    );

    // Add this line to see the actual structure
    console.log(
      'Upload service returned:',
      JSON.stringify(uploadResult, null, 2),
    );

    // Then your existing code to handle the result
    if (uploadResult instanceof File) {
      await this.fileService.processUploadedFile(uploadResult);
    } else {
      // Check if it has an entity property that's a File
      const result = uploadResult as any;
      if (result && result.entity && result.entity instanceof File) {
        await this.fileService.processUploadedFile(result.entity);
      } else {
        // Log the structure to debug, but don't try to process
        console.log('Upload result structure:', Object.keys(uploadResult));
      }
    }

    return uploadResult;
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
    type: ChunkUploadResultDto,
  })
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @ValidatedFile({
      maxSize: UploadController.getMaxFileSize(),
      mimeTypes: UploadController.getAllowedMimeTypes(),
    })
    chunk: Express.Multer.File,
    @Body() chunkUploadDto: ChunkUploadDto,
    @CurrentUser() user: User,
  ) {
    return this.uploadService.handleChunkUpload(chunk, chunkUploadDto, user);
  }

  @Post('complete/:fileId')
  @ApiOperation({ summary: 'Complete chunked upload' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Chunked upload completed',
    type: File,
  })
  async completeChunkedUpload(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ) {
    return this.uploadService.completeChunkedUpload(fileId, user);
  }

  @Get('download/:fileId')
  @ApiOperation({ summary: 'Get file download URL' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Download URL generated',
    type: DownloadUrlResultDto,
  })
  async getDownloadUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ) {
    return this.uploadService.getDownloadUrl(fileId, user);
  }

  @Get('user-files')
  @ApiOperation({ summary: 'Get user files' })
  @ApiQuery({ name: 'category', enum: FileCategory, required: false })
  @ApiQuery({ name: 'page', type: 'integer', required: false })
  @ApiQuery({ name: 'limit', type: 'integer', required: false })
  @ApiQuery({
    name: 'orderId',
    type: 'string',
    format: 'uuid',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'User files retrieved',
    schema: {
      properties: {
        files: {
          type: 'array',
          items: { $ref: '#/components/schemas/File' },
        },
        total: { type: 'integer' },
      },
    },
  })
  async getUserFiles(
    @CurrentUser() user: User,
    @Query() filters: GetFilesFilterDto,
  ) {
    return this.uploadService.getUserFiles(user, filters);
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
          items: { $ref: '#/components/schemas/File' },
        },
        total: { type: 'integer' },
      },
    },
  })
  async getOrderFiles(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    return this.uploadService.getOrderFiles(orderId, user);
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Delete file' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  async deleteFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ) {
    await this.uploadService.deleteFile(fileId, user);
    return { success: true };
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get user storage quota' })
  @ApiResponse({
    status: 200,
    description: 'Storage quota retrieved',
    type: StorageQuotaResultDto,
  })
  async getStorageQuota(@CurrentUser() user: User) {
    return this.uploadService.getStorageQuota(user);
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
    type: MultipleFilesResultDto,
  })
  @UseInterceptors(FilesInterceptor('files', 10)) // max 10 files
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadFilesDto: UploadFileDto,
    @CurrentUser() user: User,
  ) {
    return this.uploadService.uploadMultipleFiles(files, uploadFilesDto, user);
  }

  @Get(':fileId/status')
  @ApiOperation({ summary: 'Get file status' })
  @ApiParam({ name: 'fileId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'File status retrieved',
    type: FileStatusResultDto,
  })
  async getFileStatus(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ): Promise<FileStatusResultDto> {
    try {
      const statusResult = await this.uploadService.getFileStatus(fileId, user);

      // Add the ID to match FileStatusResultDto
      return {
        id: fileId, // Add this line
        ...statusResult,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'File not found') {
        throw new NotFoundException(`File with ID ${fileId} not found`);
      }
      throw error;
    }
  }
}
