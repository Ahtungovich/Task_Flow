import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResult {
  status: 'ok';
  appName: string;
  environment: string;
  database: 'connected';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getHealthStatus(): Promise<HealthCheckResult> {
    const dbConnected = await this.prisma.checkConnection();
    const appName = this.configService.get<string>('APP_NAME', 'TaskFlow');
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    if (!dbConnected) {
      throw new ServiceUnavailableException({
        status: 'error',
        appName,
        database: 'disconnected',
        message: 'Нет подключения к базе данных PostgreSQL.',
      });
    }

    return {
      status: 'ok',
      appName,
      environment,
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
