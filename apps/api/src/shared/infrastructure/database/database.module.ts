import { Global, Module, Logger } from '@nestjs/common';
import { KyselyService } from './kysely.service';
import { PrismaService } from './prisma.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('RedisProvider');

const isDesktop = process.env.DEPLOY_MODE === 'desktop';

const RedisProvider = {
  provide: 'REDIS_CLIENT',
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    if (isDesktop) {
      logger.log('Desktop mode — Redis disabled, using in-memory cache');
      // نرجع mock object بدل Redis
      return {
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        setex: async () => 'OK',
        ping: async () => 'PONG',
        on: () => {},
        status: 'ready',
        disconnect: async () => {},
      };
    }
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6380';
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis max retries reached');
          return null;
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true,
    });
    client.on('connect', () => logger.log('Redis connected'));
    client.on('error', (err) => logger.error('Redis error', err));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    return client;
  },
};

@Global()
@Module({
  providers: [KyselyService, PrismaService, RedisProvider],
  exports: [KyselyService, PrismaService, RedisProvider],
})
export class DatabaseModule {}
