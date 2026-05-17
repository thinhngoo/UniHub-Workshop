import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppDataStore } from './app-data.store';
import { encodeDatabaseUrl } from './encode-database-url';
import { InMemoryAppDataStore } from './in-memory-app-data.store';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { RegistrationsRepository } from './repository/registrations.repository';
import { UsersRepository } from './repository/users.repository';
import { WorkshopsRepository } from './repository/workshops.repository';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const raw = config.get<string>('DATABASE_URL');
        if (!raw) {
          throw new Error('DATABASE_URL must be set');
        }
        const url = encodeDatabaseUrl(raw);
        return new PrismaService({
          datasources: { db: { url } },
        });
      },
    },
    UsersRepository,
    WorkshopsRepository,
    RegistrationsRepository,
    {
      provide: AppDataStore,
      useClass: InMemoryAppDataStore,
    },
    RedisService,
  ],
  exports: [
    AppDataStore,
    PrismaService,
    RedisService,
    UsersRepository,
    WorkshopsRepository,
    RegistrationsRepository,
  ],
})
export class DatabaseModule {}
