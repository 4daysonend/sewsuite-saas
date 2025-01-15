@Process('analyze-file')
async analyzeFile(job: Job<{ fileId: string }>): Promise<void> {
  const { fileId } = job.data;

  try {
    const file = await this.fileRepository.findOne({
      where: { id: fileId }
    });

    if (!file) {
      throw new Error('File not found');
    }

    const buffer = await this.storageService.getFileContent(file);

    let analysisResults: any = {
      timestamp: new Date(),
      fileSize: buffer.length
    };

    // Analyze based on file type
    if (file.mimeType.startsWith('image/')) {
      analysisResults = {
        ...analysisResults,
        ...(await this.analyzeImage(buffer))
      };
    } else if (file.mimeType === 'application/pdf') {
      analysisResults = {
        ...analysisResults,
        ...(await this.analyzePDF(buffer))
      };
    }

    // Update file metadata with analysis results
    file.metadata = {
      ...file.metadata,
      analysis: analysisResults
    };

    await this.fileRepository.save(file);

  } catch (error) {
    this.logger.error(`Failed to analyze file: ${error.message}`);
    throw error;
  }
}

private async analyzeImage(buffer: Buffer): Promise<any> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const stats = await image.stats();

  return {
    dimensions: {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width / metadata.height
    },
    format: metadata.format,
    space: metadata.space,
    channels: metadata.channels,
    depth: metadata.depth,
    density: metadata.density,
    hasAlpha: metadata.hasAlpha,
    stats: {
      channels: stats.channels,
      isOpaque: stats.isOpaque,
      entropy: stats.entropy
    }
  };
}

private async analyzePDF(buffer: Buffer): Promise<any> {
  const data = await pdf(buffer);
  
  return {
    pageCount: data.numpages,
    info: data.info,
    version: data.version,
    metadata: data.metadata,
    textContent: {
      length: data.text.length,
      snippet: data.text.substring(0, 1000)
    }
  };
}
}