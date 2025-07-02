import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Create a data source just for migrations
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [join(__dirname, 'src', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'src', 'migrations', '**', '*.{ts,js}')],
  synchronize: false,
});

export default dataSource;