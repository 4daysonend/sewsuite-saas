import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  async checkHealth(): Promise<{
    status: string;
    info: Record<string, any>;
  }> {
    try {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();

      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      const cpuUsage = this.calculateCpuUsage(cpus);

      const status = this.determineOverallStatus(cpuUsage, memoryUsage);

      return {
        status,
        info: {
          cpu: {
            usage: cpuUsage,
            cores: cpus.length,
          },
          memory: {
            total: Math.round(totalMemory / 1024 / 1024),
            free: Math.round(freeMemory / 1024 / 1024),
            used: Math.round((totalMemory - freeMemory) / 1024 / 1024),
            usagePercent: memoryUsage.toFixed(2),
          },
          system: {
            platform: os.platform(),
            uptime: os.uptime(),
            hostname: os.hostname(),
          },
        },
      };
    } catch (error) {
      this.logger.error(`Health check error: ${(error as Error).message}`);
      return {
        status: 'error',
        info: {
          error: (error as Error).message,
        },
      };
    }
  }

  private calculateCpuUsage(cpus: os.CpuInfo[]): number {
    // This is a simple approximation. For more accurate CPU usage,
    // you'd need to take multiple samples over time
    return (
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce(
          (sum, time) => sum + time,
          0,
        );
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length
    );
  }

  private determineOverallStatus(
    cpuUsage: number,
    memoryUsage: number,
  ): string {
    if (cpuUsage > 90 || memoryUsage > 90) {
      return 'critical';
    }
    if (cpuUsage > 70 || memoryUsage > 70) {
      return 'warning';
    }
    return 'healthy';
  }
}
