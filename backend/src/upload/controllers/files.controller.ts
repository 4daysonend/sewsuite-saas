import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from '../services/file.service';
import { File } from '../entities/file.entity';

@Controller('files')
export class FilesController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: { description?: string; tags?: string[] },
  ) {
    // Create a file entity
    const fileEntity = new File();
    fileEntity.originalName = file.originalname;
    fileEntity.mimeType = file.mimetype;
    fileEntity.size = file.size;
    fileEntity.path = file.path || '';
    fileEntity.metadata = metadata;

    // Use the service to save the entity via repository
    return this.fileService.saveFile(fileEntity);
  }

  @Post(':id/thumbnails')
  async generateThumbnails(@Param('id') id: string) {
    await this.fileService.generateThumbnails(id);
    return { success: true };
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.fileService.getFileById(id);
  }
}
