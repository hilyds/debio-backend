import { CacheModule, Module } from '@nestjs/common';
import { CachesService } from './caches.service';
import * as redisStore from 'cache-manager-redis-store';

require('dotenv').config(); // eslint-disable-line

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.HOST_REDIS,
      port: process.env.PORT_REDIS,
      auth_pass: process.env.REDIS_PASSWORD,
    }),
  ],
  providers: [CachesService],
  exports: [CachesService],
})
export class CachesModule {}

export * from './caches.service';
