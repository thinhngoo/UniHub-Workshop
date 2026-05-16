import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppDataStore } from './app-data.store';
import { encodeDatabaseUrl } from './encode-database-url';
import { InMemoryAppDataStore } from './in-memory-app-data.store';
import { PrismaService } from './prisma.service';
import { UsersRepository } from './users.repository';

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
    {
      provide: AppDataStore,
      useClass: InMemoryAppDataStore,
    },
  ],
  exports: [AppDataStore, PrismaService, UsersRepository],
})
export class DatabaseModule {}
