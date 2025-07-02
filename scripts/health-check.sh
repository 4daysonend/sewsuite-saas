#!/bin/bash
set -e

API_URL=$1
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "Running health checks for $API_URL..."

for i in $(seq 1 $MAX_RETRIES); do
  echo "Health check attempt $i/$MAX_RETRIES..."
  
  # Check API health endpoint
  if curl -f -s "$API_URL/health" > /dev/null; then
    echo "✅ API health check passed"
    break
  fi
  
  if [ $i -eq $MAX_RETRIES ]; then
    echo "❌ Health check failed after $MAX_RETRIES attempts"
    exit 1
  fi
  
  sleep $RETRY_INTERVAL
done

# Additional checks
echo "Running comprehensive health checks..."

# Database connectivity
if curl -f -s "$API_URL/health/db" > /dev/null; then
  echo "✅ Database connectivity check passed"
else
  echo "❌ Database connectivity check failed"
  exit 1
fi

# Redis connectivity
if curl -f -s "$API_URL/health/redis" > /dev/null; then
  echo "✅ Redis connectivity check passed"
else
  echo "❌ Redis connectivity check failed"
  exit 1
fi

echo "All health checks passed! 🎉"