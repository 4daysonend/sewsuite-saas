import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) {
    bodyParser.raw({ type: 'application/json' })(req, res, () => {
      if (req.body) {
        // Store raw body for Stripe webhook verification
        req.rawBody = req.body;

        // Parse as JSON for the rest of the application
        try {
          req.body = JSON.parse(req.body.toString());
        } catch (err) {
          // If parsing fails, keep the raw body
          req.body = {};
        }
      }

      next();
    });
  }
}
