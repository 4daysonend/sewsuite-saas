// src/monitoring/prometheus-metrics.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as client from 'prom-client';

@Injectable()
export class PrometheusMetricsInterceptor implements NestInterceptor {
  private readonly apiResponseTime = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  private readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip metrics endpoint to avoid self-referencing metrics
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest();
      const { method, url } = req;

      // Skip the metrics endpoint to avoid self-referencing
      if (url === '/metrics') {
        return next.handle();
      }

      const routePath = this.getRoutePathFromRequest(req);
      const start = Date.now();

      return next.handle().pipe(
        tap((_data) => {
          const res = context.switchToHttp().getResponse();
          const statusCode = res.statusCode.toString();
          const responseTime = (Date.now() - start) / 1000; // Convert to seconds

          // Record metrics
          this.apiResponseTime
            .labels(method, routePath, statusCode)
            .observe(responseTime);
          this.httpRequestsTotal.labels(method, routePath, statusCode).inc();
        }),
        catchError((err) => {
          const statusCode = err.status ? err.status.toString() : '500';
          const responseTime = (Date.now() - start) / 1000;

          // Record metrics for errors as well
          this.apiResponseTime
            .labels(method, routePath, statusCode)
            .observe(responseTime);
          this.httpRequestsTotal.labels(method, routePath, statusCode).inc();

          throw err;
        }),
      );
    }

    return next.handle();
  }

  /**
   * Gets a normalized route path from the request object
   * Converts dynamic route segments to parameter placeholders
   * Example: /users/123 -> /users/:id
   */
  private getRoutePathFromRequest(request: any): string {
    // Use the original URL from the request
    const url = request.url;

    // For NestJS, try to get the route path from the handler metadata if available
    if (request.route && request.route.path) {
      return request.route.path;
    }

    // Try to get from the router (Express specific)
    if (request._parsedUrl && request._parsedUrl.pathname) {
      return request._parsedUrl.pathname;
    }

    // Fallback to the URL without query parameters
    return url.split('?')[0];
  }
}
