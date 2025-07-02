#!/bin/bash
# Generate strong secure passwords for SewSuite application
# This script creates secure random passwords and stores them in AWS Secrets Manager

set -e  # Exit immediately if a command exits with a non-zero status

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed or not in PATH. Please install it first."
    exit 1
fi

# Check AWS CLI configuration
aws sts get-caller-identity &> /dev/null || {
    echo "Error: AWS CLI is not configured properly. Run 'aws configure' first."
    exit 1
}

echo "Generating secure random passwords for SewSuite production environment..."

# Generate passwords for PostgreSQL
POSTGRES_PASSWORD=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 32 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Generate passwords for MongoDB
MONGODB_PASSWORD=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 32 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Generate passwords for Redis
REDIS_PASSWORD=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 32 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Generate password for Queue Redis
QUEUE_REDIS_PASSWORD=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 32 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Generate JWT secret
JWT_SECRET=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 48 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Generate RabbitMQ password
RABBITMQ_PASSWORD=$(aws secretsmanager get-random-password \
  --require-each-included-type \
  --password-length 32 \
  --exclude-characters "/@\"'\\" \
  --query RandomPassword \
  --output text)

# Set environment specific variables
ENV=${1:-"prod"}
REGION=${2:-"us-east-1"}
APP_NAME="sewsuite"

echo "Environment: $ENV"
echo "Region: $REGION"

# Create secrets in AWS Secrets Manager
echo "Storing secrets in AWS Secrets Manager..."

# PostgreSQL secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/postgres" \
  --description "PostgreSQL credentials for SewSuite $ENV" \
  --secret-string "{\"username\":\"sewsuite_$ENV\",\"password\":\"$POSTGRES_PASSWORD\",\"host\":\"$APP_NAME-postgres-$ENV.cluster-identifier.region.rds.amazonaws.com\",\"port\":5432,\"database\":\"sewsuiteapp\"}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/postgres" \
  --secret-string "{\"username\":\"sewsuite_$ENV\",\"password\":\"$POSTGRES_PASSWORD\",\"host\":\"$APP_NAME-postgres-$ENV.cluster-identifier.region.rds.amazonaws.com\",\"port\":5432,\"database\":\"sewsuiteapp\"}" \
  --region $REGION

# MongoDB secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/mongodb" \
  --description "MongoDB credentials for SewSuite $ENV" \
  --secret-string "{\"username\":\"mongodb_$ENV\",\"password\":\"$MONGODB_PASSWORD\",\"host\":\"$APP_NAME-mongodb-$ENV.mongodb.com\",\"port\":27017,\"database\":\"sewsuiteapp\"}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/mongodb" \
  --secret-string "{\"username\":\"mongodb_$ENV\",\"password\":\"$MONGODB_PASSWORD\",\"host\":\"$APP_NAME-mongodb-$ENV.mongodb.com\",\"port\":27017,\"database\":\"sewsuiteapp\"}" \
  --region $REGION

# Redis secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/redis" \
  --description "Redis credentials for SewSuite $ENV" \
  --secret-string "{\"password\":\"$REDIS_PASSWORD\",\"host\":\"$APP_NAME-redis-$ENV.region.cache.amazonaws.com\",\"port\":6379,\"database\":0}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/redis" \
  --secret-string "{\"password\":\"$REDIS_PASSWORD\",\"host\":\"$APP_NAME-redis-$ENV.region.cache.amazonaws.com\",\"port\":6379,\"database\":0}" \
  --region $REGION

# Queue Redis secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/queue-redis" \
  --description "Queue Redis credentials for SewSuite $ENV" \
  --secret-string "{\"password\":\"$QUEUE_REDIS_PASSWORD\",\"host\":\"$APP_NAME-redis-$ENV.region.cache.amazonaws.com\",\"port\":6379,\"database\":1}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/queue-redis" \
  --secret-string "{\"password\":\"$QUEUE_REDIS_PASSWORD\",\"host\":\"$APP_NAME-redis-$ENV.region.cache.amazonaws.com\",\"port\":6379,\"database\":1}" \
  --region $REGION

# JWT secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/jwt" \
  --description "JWT secret for SewSuite $ENV" \
  --secret-string "{\"secret\":\"$JWT_SECRET\",\"expiresIn\":\"6h\"}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/jwt" \
  --secret-string "{\"secret\":\"$JWT_SECRET\",\"expiresIn\":\"6h\"}" \
  --region $REGION

# RabbitMQ secret
aws secretsmanager create-secret \
  --name "$ENV/$APP_NAME/rabbitmq" \
  --description "RabbitMQ credentials for SewSuite $ENV" \
  --secret-string "{\"username\":\"sewsuite\",\"password\":\"$RABBITMQ_PASSWORD\",\"host\":\"$APP_NAME-rabbitmq-$ENV.mq.region.amazonaws.com\",\"port\":5671,\"vhost\":\"sewsuite\"}" \
  --region $REGION || aws secretsmanager update-secret \
  --secret-id "$ENV/$APP_NAME/rabbitmq" \
  --secret-string "{\"username\":\"sewsuite\",\"password\":\"$RABBITMQ_PASSWORD\",\"host\":\"$APP_NAME-rabbitmq-$ENV.mq.region.amazonaws.com\",\"port\":5671,\"vhost\":\"sewsuite\"}" \
  --region $REGION

echo "✅ All secrets generated and stored successfully in AWS Secrets Manager!"
echo "Secrets are stored with prefixes: $ENV/$APP_NAME/"
echo "Use AWS CLI or SDK to retrieve them in your application."

# Output instructions for next steps
echo ""
echo "Next steps:"
echo "1. Update your Terraform configuration to use these secrets"
echo "2. Update your application code to retrieve secrets from AWS Secrets Manager"
echo "3. Remove any hardcoded credentials from your codebase and configuration files"
echo ""
echo "To retrieve a secret in your application:"
echo "aws secretsmanager get-secret-value --secret-id $ENV/$APP_NAME/postgres --query SecretString --output text"