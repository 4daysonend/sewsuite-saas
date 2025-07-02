// metrics.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from '../../common/services/monitoring.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly monitoringService: MonitoringService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const { method } = req;
      const start = Date.now();

      return next.handle().pipe(
        tap(() => {
          const responseTime = Date.now() - start;
          const statusCode = context.switchToHttp().getResponse().statusCode;
          const path = this.normalizePath(req);

          // Use the monitoring service to record the API call
          this.monitoringService.recordApiCall(
            method,
            path,
            statusCode,
            responseTime,
          );
        }),
      );
    }
    return next.handle();
  }

  private normalizePath(request: any): string {
    // Get a more normalized path for better metrics aggregation
    if (request.route && request.route.path) {
      return request.route.path;
    }
    return request.url.split('?')[0];
  }
}
