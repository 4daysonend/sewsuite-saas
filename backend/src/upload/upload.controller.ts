import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  UseGuards,
  BadRequestException,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/decorators/user.decorator';
import { UploadService } from './upload.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('uploads')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^(image\/|application\/pdf)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @User() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.uploadService.uploadFile(file, user.id);
  }

  @Get('job/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get job status' })
  async getJobStatus(@Param('id') jobId: string) {
    return this.uploadService.getJobStatus(jobId);
  }
}
