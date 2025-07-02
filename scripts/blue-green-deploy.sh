#!/bin/bash
set -e

CLUSTER_NAME="sewsuite-cluster-production"
BACKEND_SERVICE="sewsuite-backend-production"
FRONTEND_SERVICE="sewsuite-frontend-production"

echo "Starting Blue-Green Deployment..."

# Get current task definition
CURRENT_BACKEND_TASK=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $BACKEND_SERVICE --query 'services[0].taskDefinition' --output text)
CURRENT_FRONTEND_TASK=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $FRONTEND_SERVICE --query 'services[0].taskDefinition' --output text)

# Create new task definitions with latest images
NEW_BACKEND_TASK=$(aws ecs register-task-definition \
  --cli-input-json file://backend-task-def.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)

NEW_FRONTEND_TASK=$(aws ecs register-task-definition \
  --cli-input-json file://frontend-task-def.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)

# Update services to use new task definitions
echo "Updating backend service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $BACKEND_SERVICE \
  --task-definition $NEW_BACKEND_TASK

echo "Updating frontend service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $FRONTEND_SERVICE \
  --task-definition $NEW_FRONTEND_TASK

# Wait for deployment to stabilize
echo "Waiting for services to stabilize..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $BACKEND_SERVICE $FRONTEND_SERVICE

echo "Blue-Green deployment completed successfully!"