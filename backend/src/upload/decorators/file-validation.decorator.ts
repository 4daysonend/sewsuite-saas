import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';

export const ValidatedFile = createParamDecorator(
  (data: { maxSize: number; mimeTypes: string[] }, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const file = request.file;

    const pipe = new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: data.maxSize }),
        new FileTypeValidator({ fileType: data.mimeTypes.join('|') }),
      ],
    });

    return pipe.transform(file);
  },
);
