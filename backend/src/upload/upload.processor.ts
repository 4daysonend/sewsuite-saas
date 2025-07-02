import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { UploadMetricsService } from '../metrics/upload-metrics.service';
import { ErrorLogService } from '../logging/error-log.service';

@Processor('upload')
export class UploadProcessor {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(
    private readonly metricsService: UploadMetricsService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  @Process('processFile')
  async handleFileJob(
    job: Job<{
      fileId: string;
      filePath: string;
      userId: string;
      originalFilename: string;
      fileType: string;
      fileSize: number;
    }>,
  ) {
    const startTime = Date.now();
    this.logger.log(
      `Processing file job ${job.id} for file: ${job.data.originalFilename}`,
    );

    try {
      // 1. Validate file format and integrity
      await this.validateFile(job.data.filePath, job.data.fileType);

      // 2. Scan for viruses (implement or integrate with antivirus service)
      await this.scanFileForViruses(job.data.filePath);

      // 3. Extract metadata if needed (e.g., PDF info, image dimensions)
      const metadata = await this.extractMetadata(
        job.data.filePath,
        job.data.fileType,
      );

      // 4. Any additional processing (e.g., image resizing, text extraction)
      const processedData = await this.performAdditionalProcessing(job.data);

      // 5. Mark file as processed in your database
      // await this.fileService.markAsProcessed(job.data.fileId, metadata);

      // 6. Record metrics
      const processingTime = Date.now() - startTime;
      await this.metricsService.recordFileProcessing({
        fileId: job.data.fileId,
        userId: job.data.userId,
        fileType: job.data.fileType,
        fileSize: job.data.fileSize,
        processingTimeMs: processingTime,
        status: 'success',
      });

      this.logger.log(
        `Successfully processed file ${job.data.originalFilename} in ${processingTime}ms`,
      );

      return {
        success: true,
        fileId: job.data.fileId,
        metadata,
        processedData,
      };
    } catch (error: unknown) {
      // Type check error before accessing properties
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log error with proper type checking
      this.logger.error(
        `Error processing file ${job.data.originalFilename}`,
        errorStack,
      );

      // Log to error service with proper type checking
      await this.errorLogService.logError({
        source: 'file_processing',
        message: `Failed to process file: ${job.data.originalFilename}`,
        details: errorMessage,
        stack: errorStack,
        metadata: {
          fileId: job.data.fileId,
          userId: job.data.userId,
          jobId: job.id.toString(),
        },
      });
      // Log to error service with proper type checking
      // await this.errorLogService.logError({
      //  source: 'file_processing',
      //  message: `Failed to process file: ${job.data.originalFilename}`,
      //  details: errorMessage,
      //  stack: errorStack,
      //  metadata: {
      //    fileId: job.data.fileId,
      //    userId: job.data.userId,
      //    jobId: job.id.toString(),
      //  },
      // });
      throw error;
      // Record metrics with proper type checking
      await this.metricsService.recordFileProcessing({
        fileId: job.data.fileId,
        userId: job.data.userId,
        fileType: job.data.fileType,
        fileSize: job.data.fileSize,
        processingTimeMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: errorMessage,
      });

      // Re-throw the error
      throw error;
    }
  }

  private async validateFile(
    filePath: string,
    fileType: string,
  ): Promise<boolean> {
    // Implement validation logic based on file type
    // For example, validate PDF structure, image format, etc.
    this.logger.debug(`Validating file: ${filePath} of type ${fileType}`);

    // Example validation for PDF files
    if (fileType === 'application/pdf') {
      // Use pdf-parse or similar library to validate PDF structure
      // const pdf = await pdfParse(fs.readFileSync(filePath));
      // if (!pdf.numpages) throw new Error('Invalid PDF file');
    }

    // Example validation for images
    if (fileType.startsWith('image/')) {
      // Use sharp or similar library to validate image
      // const image = await sharp(filePath).metadata();
      // if (!image.width || !image.height) throw new Error('Invalid image file');
    }

    return true;
  }

  private async scanFileForViruses(filePath: string): Promise<void> {
    // Integrate with antivirus service
    // You might want to use a library like clamscan or call an external API
    this.logger.debug(`Scanning file for viruses: ${filePath}`);

    // Example placeholder for virus scanning
    // const result = await virusScanner.scanFile(filePath);
    // if (result.infected) throw new Error('Virus detected in file');
  }

  private async extractMetadata(
    filePath: string,
    fileType: string,
  ): Promise<Record<string, any>> {
    // Extract metadata from file based on type
    this.logger.debug(`Extracting metadata from file: ${filePath}`);

    const metadata: Record<string, any> = {
      processedAt: new Date().toISOString(),
    };

    // Example metadata extraction for different file types
    if (fileType === 'application/pdf') {
      // const pdf = await pdfParse(fs.readFileSync(filePath));
      // metadata.pageCount = pdf.numpages;
      // metadata.author = pdf.info?.Author;
      // metadata.title = pdf.info?.Title;
    }

    if (fileType.startsWith('image/')) {
      // const image = await sharp(filePath).metadata();
      // metadata.width = image.width;
      // metadata.height = image.height;
      // metadata.format = image.format;
    }

    return metadata;
  }

  private async performAdditionalProcessing(jobData: any): Promise<any> {
    // Implement any additional processing needed for your application
    // For example: image resizing, PDF text extraction, etc.
    this.logger.debug(
      `Performing additional processing for file: ${jobData.originalFilename}`,
    );

    // This will depend on your specific requirements
    return { processed: true };
  }
}
