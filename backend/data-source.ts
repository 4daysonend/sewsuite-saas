import { DataSource } from 'typeorm';
import AWS from 'aws-sdk';

const secretsManager = new AWS.SecretsManager({ region: 'us-west-2' });

async function getDatabaseCredentials() {
  const secret = await secretsManager
    .getSecretValue({ SecretId: 'your-secret-id' })
    .promise();

  if (!secret.SecretString) {
    throw new Error('Failed to retrieve database credentials');
  }

  return JSON.parse(secret.SecretString);
}

let AppDataSource = new DataSource({
  type: 'postgres',
  host: '',
  port: 5432,
  username: '',
  password: '',
  database: '',
  entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/src/migration/**/*.ts'],
  synchronize: false,
});

async function initializeDataSource() {
  const databaseCredentials = await getDatabaseCredentials();

  AppDataSource = new DataSource({
    type: 'postgres',
    host: databaseCredentials.POSTGRES_HOST,
    port: parseInt(databaseCredentials.POSTGRES_PORT, 10),
    username: databaseCredentials.POSTGRES_USER,
    password: databaseCredentials.POSTGRES_PASSWORD,
    database: databaseCredentials.POSTGRES_DB,
    entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/src/migration/**/*.ts'],
    synchronize: false,
  });

  return AppDataSource;
}

export { AppDataSource, initializeDataSource };
export default AppDataSource;
