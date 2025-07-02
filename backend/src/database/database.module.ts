// backend/src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: ['CONFIG_OPTIONS'],
      useFactory: async (configOptions) => ({
        type: 'postgres',
        host: configOptions.getConfig('DB_HOST'),
        port: parseInt(configOptions.getConfig('DB_PORT')),
        username: configOptions.getConfig('DB_USER'),
        password: configOptions.getConfig('DB_PASSWORD'),
        database: configOptions.getConfig('DB_NAME'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: configOptions.getConfig('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
