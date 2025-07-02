import dbConfig from './config/database';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import Redis from 'ioredis';

async function initializeDatabases() {
  // Initialize all database configurations
  await dbConfig.initialize();

  // PostgreSQL connection
  const pgPool = new Pool(dbConfig.getPostgresConfig());

  // MongoDB connection
  await mongoose.connect(
    dbConfig.getMongoDBConfig().uri,
    dbConfig.getMongoDBConfig().options,
  );

  // Redis connection
  const redisClient = new Redis(dbConfig.getRedisConfig());

  // Queue Redis connection
  const queueRedisClient = new Redis(dbConfig.getQueueRedisConfig());

  return { pgPool, redisClient, queueRedisClient };
}

// Use the connections
initializeDatabases()
  .then((connections) => {
    // Application startup with secure connections
    console.log('All databases connected successfully');
    startServer(connections);
  })
  .catch((error) => {
    console.error('Failed to initialize databases:', error);
    process.exit(1);
  });
