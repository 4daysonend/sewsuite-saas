
## 2. Create Recovery Testing Procedures

```bash
#!/bin/bash
# Test RDS database restore from a snapshot

set -e

# Parse arguments
ENVIRONMENT=${1:-staging}
DATE=$(date +%Y-%m-%d)
SNAPSHOT_PREFIX="sewsuite-db-${ENVIRONMENT}"
TEST_INSTANCE_ID="${SNAPSHOT_PREFIX}-restore-test-${DATE}"
REGION=${2:-us-east-1}

echo "Starting RDS restore test for environment: ${ENVIRONMENT}"

# Get latest automated snapshot
echo "Identifying latest automated snapshot..."
SNAPSHOT_ID=$(aws rds describe-db-snapshots \
  --db-instance-identifier ${SNAPSHOT_PREFIX} \
  --snapshot-type automated \
  --query "sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier" \
  --output text \
  --region ${REGION})

if [ -z "$SNAPSHOT_ID" ]; then
  echo "Error: No snapshot found for ${SNAPSHOT_PREFIX}"
  exit 1
fi

echo "Found snapshot: ${SNAPSHOT_ID}"

# Restore the snapshot to a test instance
echo "Restoring snapshot to test instance ${TEST_INSTANCE_ID}..."
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ${TEST_INSTANCE_ID} \
  --db-snapshot-identifier ${SNAPSHOT_ID} \
  --db-instance-class db.t3.micro \
  --no-publicly-accessible \
  --region ${REGION}

# Wait for the instance to be available
echo "Waiting for instance to be available..."
aws rds wait db-instance-available \
  --db-instance-identifier ${TEST_INSTANCE_ID} \
  --region ${REGION}

# Get the endpoint
ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier ${TEST_INSTANCE_ID} \
  --query "DBInstances[0].Endpoint.Address" \
  --output text \
  --region ${REGION})

echo "Restored database is available at: ${ENDPOINT}"

# Run validation script
echo "Validating restored database..."
./scripts/disaster-recovery/validate-restore.sh \
  --host ${ENDPOINT} \
  --environment ${ENVIRONMENT}

# Clean up the test instance
echo "Test completed. Cleaning up test instance..."
aws rds delete-db-instance \
  --db-instance-identifier ${TEST_INSTANCE_ID} \
  --skip-final-snapshot \
  --region ${REGION}

echo "✅ RDS restore test completed successfully!"