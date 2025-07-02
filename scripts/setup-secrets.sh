#!/bin/bash
# rotate-secrets.sh
# Automatically rotate secrets

# Get current date for versioning
CURRENT_DATE=$(date +%Y-%m-%d)

echo "Starting secret rotation process - $CURRENT_DATE"

# Rotate database password
NEW_DB_PASSWORD=$(openssl rand -base64 32)
aws secretsmanager update-secret --secret-id sewsuite/prod/database --secret-string '{"POSTGRES_USER":"sewsuite_prod","POSTGRES_PASSWORD":"'$NEW_DB_PASSWORD'","POSTGRES_DB":"sewsuiteapp"}'

# Update the database with new password
PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id sewsuite/prod/database --query 'SecretString' --output text | jq -r '.POSTGRES_PASSWORD')
echo "ALTER USER sewsuite_prod WITH PASSWORD '$NEW_DB_PASSWORD';" | \
  psql -h $(aws rds describe-db-instances --db-instance-identifier sewsuite-db-production --query 'DBInstances[0].Endpoint.Address' --output text) \
       -U sewsuite_prod -d sewsuiteapp

# Rotate Redis password
NEW_REDIS_PASSWORD=$(openssl rand -base64 32)
aws secretsmanager update-secret --secret-id sewsuite/prod/redis --secret-string '{"REDIS_PASSWORD":"'$NEW_REDIS_PASSWORD'"}'

# Update ElastiCache with new Redis password
aws elasticache modify-replication-group \
  --replication-group-id sewsuite-redis-production \
  --auth-token "$NEW_REDIS_PASSWORD" \
  --apply-immediately

# Rotate JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 48)
aws secretsmanager update-secret --secret-id sewsuite/prod/jwt --secret-string '{"JWT_SECRET":"'$NEW_JWT_SECRET'","JWT_EXPIRATION":"6h"}'

echo "Secret rotation completed successfully!"
echo "Be aware that service restarts may be required for some changes to take effect."