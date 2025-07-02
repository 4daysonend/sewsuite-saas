#!/bin/bash
# Validate restored database

set -e

# Default values
HOST=""
PORT="5432"
USER="postgres"
DATABASE="sewsuiteapp"
ENVIRONMENT="production"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --host) HOST="$2"; shift ;;
    --port) PORT="$2"; shift ;;
    --user) USER="$2"; shift ;;
    --database) DATABASE="$2"; shift ;;
    --environment) ENVIRONMENT="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# If host not provided, get from AWS based on environment
if [ -z "$HOST" ]; then
  echo "No host provided, retrieving from AWS for environment: ${ENVIRONMENT}"
  HOST=$(aws rds describe-db-instances \
    --db-instance-identifier "sewsuite-db-${ENVIRONMENT}" \
    --query "DBInstances[0].Endpoint.Address" \
    --output text)
fi

echo "=== Database Restore Validation ==="
echo "Host: ${HOST}"
echo "Database: ${DATABASE}"
echo "Environment: ${ENVIRONMENT}"

# Get password from AWS Secrets Manager
echo "Retrieving database credentials from AWS Secrets Manager..."
DB_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id "${ENVIRONMENT}/sewsuite/postgres" \
  --query "SecretString" \
  --output text)

PASSWORD=$(echo $DB_CREDS | jq -r .password)

# Define validation queries
echo "Running validation queries..."

# Check if database is accessible
echo "1. Testing database connection..."
PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -c "SELECT 1" > /dev/null || \
  { echo "Error: Cannot connect to database!"; exit 1; }
echo "✓ Database connection successful"

# Check if critical tables exist
echo "2. Checking for critical tables..."
tables=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' 
  AND table_name IN ('users', 'projects', 'subscriptions', 'patterns')
")

if [[ $tables != *users* ]]; then
  echo "Error: Missing critical table 'users'!"
  exit 1
fi
if [[ $tables != *projects* ]]; then
  echo "Error: Missing critical table 'projects'!"
  exit 1
fi
echo "✓ Critical tables exist"

# Check row counts for key tables
echo "3. Checking row counts for key tables..."
user_count=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "SELECT COUNT(*) FROM users")
user_count=$(echo $user_count | tr -d ' ')

if [ "$user_count" -lt 1 ]; then
  echo "Warning: User table contains no records!"
  exit 1
fi
echo "✓ User table contains ${user_count} records"

# Verify data integrity with sample checks
echo "4. Verifying data integrity..."
# Check if admin user exists
admin_check=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "
  SELECT COUNT(*) FROM users WHERE role = 'admin' AND email LIKE '%@sewsuite.co'
")
admin_check=$(echo $admin_check | tr -d ' ')

if [ "$admin_check" -lt 1 ]; then
  echo "Warning: No admin users found!"
  exit 1
fi
echo "✓ Admin users exist"

# Check database size
echo "5. Checking database size..."
db_size=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "
  SELECT pg_size_pretty(pg_database_size('${DATABASE}'))
")
echo "✓ Database size: ${db_size}"

# Run custom validation for specific business data
echo "6. Running business data validation..."
projects_count=$(PGPASSWORD=$PASSWORD psql -h $HOST -p $PORT -U $USER -d $DATABASE -t -c "SELECT COUNT(*) FROM projects")
projects_count=$(echo $projects_count | tr -d ' ')
echo "✓ Projects table contains ${projects_count} records"

# Final validation summary
echo ""
echo "=== Validation Summary ==="
echo "✅ Database connection: SUCCESS"
echo "✅ Critical tables: SUCCESS"
echo "✅ Data integrity: SUCCESS"
echo "✅ Database size: ${db_size}"
echo "✅ Total users: ${user_count}"
echo "✅ Total projects: ${projects_count}"

echo ""
echo "✅ Database restore validation completed successfully!"