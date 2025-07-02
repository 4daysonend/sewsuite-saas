import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

function getDataSourceOptions(): DataSourceOptions {
  // Check if running in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Define default options
  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    synchronize: !isProduction,
    ssl: isProduction,
  };
}

// Create and export the data source
const AppDataSource = new DataSource(getDataSourceOptions());
export default AppDataSource;
