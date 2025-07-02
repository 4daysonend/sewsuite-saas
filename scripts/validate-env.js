// filepath: c:\Users\PSXLHP276\sewsuite-saas\scripts\validate-env.js
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: process.env.ENV_FILE || '.env.production.local' });

// List of variables that shouldn't contain REPLACE_WITH
const sensitiveVars = [
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'AWS_SECRET_ACCESS_KEY',
  'EMAIL_PASSWORD',
  'STRIPE_SECRET_KEY',
  'SESSION_SECRET',
  'SENTRY_DSN'
];

let hasPlaceholders = false;

sensitiveVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.includes('REPLACE_WITH')) {
    console.error(`⚠️ Error: ${varName} contains a placeholder value`);
    hasPlaceholders = true;
  }
});

if (hasPlaceholders) {
  console.error('Environment validation failed. Fix the issues before deploying.');
  process.exit(1);
} else {
  console.log('✅ Environment validation passed.');
}