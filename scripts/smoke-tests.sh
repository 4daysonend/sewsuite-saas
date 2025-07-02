#!/bin/bash
set -e

API_URL=$1

echo "Running smoke tests against $API_URL..."

# Test 1: API responds
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$response" != "200" ]; then
  echo "❌ API health check failed with status $response"
  exit 1
fi
echo "✅ API health check passed"

# Test 2: Authentication endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
if [ "$response" != "400" ] && [ "$response" != "422" ]; then
  echo "❌ Auth endpoint test failed with status $response"
  exit 1
fi
echo "✅ Auth endpoint responding correctly"

# Test 3: Database connectivity
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health/db")
if [ "$response" != "200" ]; then
  echo "❌ Database connectivity test failed with status $response"
  exit 1
fi
echo "✅ Database connectivity test passed"

echo "All smoke tests passed! 🎉"