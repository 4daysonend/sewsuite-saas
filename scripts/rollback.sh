#!/bin/bash
set -e

CLUSTER_NAME="sewsuite-cluster-production"
BACKEND_SERVICE="sewsuite-backend-production"
FRONTEND_SERVICE="sewsuite-frontend-production"

echo "🚨 Initiating rollback procedure..."

# Get previous task definitions
BACKEND_TASKS=$(aws ecs list-task-definitions --family-prefix sewsuite-backend-production --status ACTIVE --sort DESC --max-items 2 --query 'taskDefinitionArns' --output text)
FRONTEND_TASKS=$(aws ecs list-task-definitions --family-prefix sewsuite-frontend-production --status ACTIVE --sort DESC --max-items 2 --query 'taskDefinitionArns' --output text)

# Get previous (second most recent) task definitions
PREVIOUS_BACKEND_TASK=$(echo $BACKEND_TASKS | cut -d' ' -f2)
PREVIOUS_FRONTEND_TASK=$(echo $FRONTEND_TASKS | cut -d' ' -f2)

# Rollback services
echo "Rolling back backend service to $PREVIOUS_BACKEND_TASK..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $BACKEND_SERVICE \
  --task-definition $PREVIOUS_BACKEND_TASK

echo "Rolling back frontend service to $PREVIOUS_FRONTEND_TASK..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $FRONTEND_SERVICE \
  --task-definition $PREVIOUS_FRONTEND_TASK

# Wait for rollback to complete
echo "Waiting for rollback to complete..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $BACKEND_SERVICE $FRONTEND_SERVICE

echo "✅ Rollback completed successfully!"