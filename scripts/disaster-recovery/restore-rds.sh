#!/bin/bash
# Restore RDS database from snapshot or point-in-time

set -e

# Default values
REGION="us-east-1"
SOURCE_ENV="production"
TARGET_ENV="production"
POINT_IN_TIME=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --snapshot-id) SNAPSHOT_ID="$2"; shift ;;
    --point-in-time) POINT_IN_TIME="$2"; shift ;;
    --source-env) SOURCE_ENV="$2"; shift ;;
    --target-env) TARGET_ENV="$2"; shift ;;
    --region) REGION="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Set instance identifiers
SOURCE_INSTANCE="sewsuite-db-${SOURCE_ENV}"
TARGET_INSTANCE="sewsuite-db-${TARGET_ENV}"

echo "=== RDS Database Restore ==="
echo "Source Environment: ${SOURCE_ENV}"
echo "Target Environment: ${TARGET_ENV}"
echo "Region: ${REGION}"

# Check if the target instance exists
DB_EXISTS=$(aws rds describe-db-instances \
  --query "DBInstances[?DBInstanceIdentifier=='${TARGET_INSTANCE}'].DBInstanceIdentifier" \
  --output text \
  --region ${REGION} || echo "")

# If restoring to an existing instance, rename the current one
if [ ! -z "$DB_EXISTS" ]; then
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  BACKUP_INSTANCE="${TARGET_INSTANCE}-backup-${TIMESTAMP}"
  
  echo "Target database exists. Creating final backup before restore..."
  # Create a final snapshot
  aws rds create-db-snapshot \
    --db-instance-identifier ${TARGET_INSTANCE} \
    --db-snapshot-identifier ${TARGET_INSTANCE}-final-${TIMESTAMP} \
    --region ${REGION}
  
  echo "Waiting for final snapshot to complete..."
  aws rds wait db-snapshot-completed \
    --db-snapshot-identifier ${TARGET_INSTANCE}-final-${TIMESTAMP} \
    --region ${REGION}
  
  echo "Renaming existing database to ${BACKUP_INSTANCE}..."
  # Rename the existing instance
  aws rds modify-db-instance \
    --db-instance-identifier ${TARGET_INSTANCE} \
    --new-db-instance-identifier ${BACKUP_INSTANCE} \
    --apply-immediately \
    --region ${REGION}
  
  echo "Waiting for rename operation to complete..."
  # Wait for the rename to complete
  aws rds wait db-instance-available \
    --db-instance-identifier ${BACKUP_INSTANCE} \
    --region ${REGION}
fi

# Restore the database
if [ ! -z "$SNAPSHOT_ID" ]; then
  # Restore from snapshot
  echo "Restoring from snapshot: ${SNAPSHOT_ID}..."
  aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier ${TARGET_INSTANCE} \
    --db-snapshot-identifier ${SNAPSHOT_ID} \
    --db-instance-class db.t3.medium \
    --region ${REGION}
elif [ ! -z "$POINT_IN_TIME" ]; then
  # Restore to a point in time
  echo "Restoring to point-in-time: ${POINT_IN_TIME}..."
  aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier ${SOURCE_INSTANCE} \
    --target-db-instance-identifier ${TARGET_INSTANCE} \
    --restore-time ${POINT_IN_TIME} \
    --db-instance-class db.t3.medium \
    --region ${REGION}
else
  # No restore point specified, use latest snapshot
  echo "No snapshot or point-in-time specified. Finding latest automated snapshot..."
  SNAPSHOT_ID=$(aws rds describe-db-snapshots \
    --db-instance-identifier ${SOURCE_INSTANCE} \
    --snapshot-type automated \
    --query "sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier" \
    --output text \
    --region ${REGION})
  
  echo "Restoring from latest snapshot: ${SNAPSHOT_ID}..."
  aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier ${TARGET_INSTANCE} \
    --db-snapshot-identifier ${SNAPSHOT_ID} \
    --db-instance-class db.t3.medium \
    --region ${REGION}
fi

echo "Waiting for database restoration to complete..."
aws rds wait db-instance-available \
  --db-instance-identifier ${TARGET_INSTANCE} \
  --region ${REGION}

# Get the new endpoint
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier ${TARGET_INSTANCE} \
  --query "DBInstances[0].Endpoint.Address" \
  --output text \
  --region ${REGION})

echo "Database successfully restored!"
echo "New endpoint: ${NEW_ENDPOINT}"

# Update application configuration if needed
if [ "${TARGET_ENV}" = "production" ]; then
  echo "Updating application configuration with new database endpoint..."
  ./scripts/disaster-recovery/reconfigure-app-database.sh --new-endpoint ${NEW_ENDPOINT}
fi

echo "✅ Database restore completed successfully!"