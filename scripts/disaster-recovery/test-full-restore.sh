#!/bin/bash
# Test full system restore in a separate environment

set -e

ENVIRONMENT=${1:-staging}
REGION=${2:-us-east-1}
TIMESTAMP=$(date +%Y%m%d%H%M%S)
TEST_PREFIX="dr-test-${TIMESTAMP}"

echo "Starting full system restore test in ${ENVIRONMENT} environment"

# Create a temporary tfvars file for the test
cat > terraform.${TEST_PREFIX}.tfvars <<EOF
environment = "${TEST_PREFIX}"
aws_region = "${REGION}"
vpc_cidr = "10.100.0.0/16"  # Use different CIDR from production
alarm_email = "devops@sewsuite.co"
EOF

# Initialize Terraform with the test workspace
terraform workspace new ${TEST_PREFIX} || terraform workspace select ${TEST_PREFIX}

# Apply infrastructure with test configuration
echo "Creating test infrastructure..."
terraform apply -var-file=terraform.${TEST_PREFIX}.tfvars -auto-approve

# Get outputs for the test environment
DB_ENDPOINT=$(terraform output -raw db_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
APP_URL=$(terraform output -raw app_url)
API_URL=$(terraform output -raw api_url)

echo "Test environment created:"
echo "- Database: ${DB_ENDPOINT}"
echo "- Redis: ${REDIS_ENDPOINT}"
echo "- App URL: ${APP_URL}"
echo "- API URL: ${API_URL}"

# Restore database from production backup
echo "Restoring database from production backup..."
./scripts/disaster-recovery/restore-rds.sh \
  --source-env production \
  --target-env ${TEST_PREFIX} \
  --region ${REGION}

# Deploy application containers
echo "Deploying application containers..."
./scripts/disaster-recovery/restore-application.sh \
  --source-env production \
  --target-env ${TEST_PREFIX}

# Run validation tests
echo "Running validation tests..."
./scripts/disaster-recovery/validate-full-restore.sh \
  --environment ${TEST_PREFIX} \
  --api-url ${API_URL}

# Record test results
echo "Saving test results..."
mkdir -p ./test-results/dr-tests
echo "DR Test ${TIMESTAMP} - $(date) - PASSED" >> ./test-results/dr-tests/history.log

# Clean up - destroy test environment if not keeping for analysis
if [[ "$3" != "--keep" ]]; then
  echo "Cleaning up test environment..."
  terraform destroy -var-file=terraform.${TEST_PREFIX}.tfvars -auto-approve
  terraform workspace select default
  terraform workspace delete ${TEST_PREFIX}
  rm terraform.${TEST_PREFIX}.tfvars
  echo "Test environment cleaned up."
fi

echo "✅ Full system restore test completed successfully!"
echo "Results recorded in ./test-results/dr-tests/history.log"