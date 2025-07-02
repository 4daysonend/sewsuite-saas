#!/bin/bash
# Validate full system restore including application and data

set -e

# Default values
ENVIRONMENT="production"
API_URL=""
APP_URL=""
TIMEOUT=300

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --environment) ENVIRONMENT="$2"; shift ;;
    --api-url) API_URL="$2"; shift ;;
    --app-url) APP_URL="$2"; shift ;;
    --timeout) TIMEOUT="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# If URLs not provided, construct them based on environment
if [ -z "$API_URL" ]; then
  if [ "$ENVIRONMENT" = "production" ]; then
    API_URL="https://api.sewsuite.co"
  else
    API_URL="https://api-${ENVIRONMENT}.sewsuite.co"
  fi
fi

if [ -z "$APP_URL" ]; then
  if [ "$ENVIRONMENT" = "production" ]; then
    APP_URL="https://app.sewsuite.co"
  else
    APP_URL="https://${ENVIRONMENT}.sewsuite.co"
  fi
fi

echo "=== Full System Restore Validation ==="
echo "Environment: ${ENVIRONMENT}"
echo "API URL: ${API_URL}"
echo "App URL: ${APP_URL}"

# Get test credentials from Secrets Manager
echo "Retrieving test credentials from AWS Secrets Manager..."
TEST_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id "${ENVIRONMENT}/sewsuite/test-accounts" \
  --query "SecretString" \
  --output text)

TEST_USER=$(echo $TEST_CREDS | jq -r .test_username)
TEST_PASS=$(echo $TEST_CREDS | jq -r .test_password)

echo "1. Checking API health endpoint..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health")
if [ "$API_HEALTH" != "200" ]; then
  echo "Error: API health check failed! Status code: ${API_HEALTH}"
  exit 1
fi
echo "✓ API health check passed"

echo "2. Checking frontend application..."
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}")
if [ "$APP_STATUS" != "200" ]; then
  echo "Error: Frontend application check failed! Status code: ${APP_STATUS}"
  exit 1
fi
echo "✓ Frontend application check passed"

echo "3. Testing authentication API..."
# Get CSRF token if needed
CSRF_TOKEN=$(curl -s -c cookies.txt "${API_URL}/auth/csrf" | jq -r .token)

# Authenticate
AUTH_RESPONSE=$(curl -s -b cookies.txt -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -d "{\"email\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}")

AUTH_SUCCESS=$(echo $AUTH_RESPONSE | jq -r .success)
if [ "$AUTH_SUCCESS" != "true" ]; then
  echo "Error: Authentication failed!"
  echo $AUTH_RESPONSE
  exit 1
fi
echo "✓ Authentication check passed"

# Get JWT token for API calls
JWT_TOKEN=$(echo $AUTH_RESPONSE | jq -r .token)

echo "4. Testing data retrieval APIs..."
USER_DATA=$(curl -s -H "Authorization: Bearer ${JWT_TOKEN}" "${API_URL}/users/me")
USER_ID=$(echo $USER_DATA | jq -r .id)

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "Error: Could not retrieve user data!"
  exit 1
fi
echo "✓ User data retrieval check passed"

# Check projects API
PROJECTS=$(curl -s -H "Authorization: Bearer ${JWT_TOKEN}" "${API_URL}/projects")
PROJECT_COUNT=$(echo $PROJECTS | jq '. | length')
echo "✓ Projects API returned ${PROJECT_COUNT} projects"

echo "5. Testing file storage..."
# Upload a small test file
UPLOAD_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer ${JWT_TOKEN}" \
  -F "file=@./scripts/disaster-recovery/test-assets/test-image.jpg" \
  "${API_URL}/uploads")

FILE_URL=$(echo $UPLOAD_RESPONSE | jq -r .url)

if [ -z "$FILE_URL" ] || [ "$FILE_URL" = "null" ]; then
  echo "Error: File upload failed!"
  exit 1
fi

# Download the file to verify
DOWNLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FILE_URL}")
if [ "$DOWNLOAD_STATUS" != "200" ]; then
  echo "Error: File download failed! Status code: ${DOWNLOAD_STATUS}"
  exit 1
fi
echo "✓ File storage check passed"

echo "6. Testing database queries..."
# Already validated database separately, but do a quick check through API
DB_CHECK=$(curl -s -H "Authorization: Bearer ${JWT_TOKEN}" "${API_URL}/system/database-check")
DB_STATUS=$(echo $DB_CHECK | jq -r .status)

if [ "$DB_STATUS" != "healthy" ]; then
  echo "Error: Database check through API failed!"
  exit 1
fi
echo "✓ Database check through API passed"

echo "7. Testing cache functionality..."
# Make a cacheable request
curl -s -H "Authorization: Bearer ${JWT_TOKEN}" "${API_URL}/projects?cache=check" > /dev/null
# Make it again and verify it was cached
CACHE_RESPONSE=$(curl -s -H "Authorization: Bearer ${JWT_TOKEN}" "${API_URL}/projects?cache=check")
CACHE_HIT=$(echo $CACHE_RESPONSE | jq -r .cacheHit)

if [ "$CACHE_HIT" != "true" ]; then
  echo "Warning: Cache does not appear to be working!"
else
  echo "✓ Cache functionality check passed"
fi

# Cleanup
rm -f cookies.txt

echo ""
echo "=== Validation Summary ==="
echo "✅ API health: SUCCESS"
echo "✅ Frontend application: SUCCESS"
echo "✅ Authentication: SUCCESS"
echo "✅ Data retrieval: SUCCESS (${PROJECT_COUNT} projects found)"
echo "✅ File storage: SUCCESS"
echo "✅ Database connectivity: SUCCESS"
echo "✅ Cache functionality: ${CACHE_HIT:-WARNING}"

echo ""
echo "✅ Full system restore validation completed successfully!"