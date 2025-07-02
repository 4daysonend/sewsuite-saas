#!/bin/bash
# Restore application to a specific version

set -e

# Default values
VERSION="latest"
ENVIRONMENT="production"
REGION="us-east-1"
CLUSTER="sewsuite-cluster-prod"
BACKEND_SERVICE="sewsuite-backend-service"
FRONTEND_SERVICE="sewsuite-frontend-service"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --version) VERSION="$2"; shift ;;
    --environment|-e) ENVIRONMENT="$2"; shift ;;
    --region) REGION="$2"; shift ;;
    --source-env) SOURCE_ENV="$2"; shift ;;
    --target-env) TARGET_ENV="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

if [[ -n "$SOURCE_ENV" && -n "$TARGET_ENV" ]]; then
  echo "=== Cross-Environment Application Restore ==="
  echo "Source Environment: ${SOURCE_ENV}"
  echo "Target Environment: ${TARGET_ENV}"
  
  SOURCE_CLUSTER="sewsuite-cluster-${SOURCE_ENV}"
  TARGET_CLUSTER="sewsuite-cluster-${TARGET_ENV}"
  
  # Get current task definitions from source environment
  echo "Fetching task definitions from source environment..."
  SOURCE_BACKEND_TASK=$(aws ecs describe-services \
    --cluster ${SOURCE_CLUSTER} \
    --services sewsuite-backend-service \
    --query "services[0].taskDefinition" \
    --output text \
    --region ${REGION})
  
  SOURCE_FRONTEND_TASK=$(aws ecs describe-services \
    --cluster ${SOURCE_CLUSTER} \
    --services sewsuite-frontend-service \
    --query "services[0].taskDefinition" \
    --output text \
    --region ${REGION})
  
  # Get task definition details
  BACKEND_DEF=$(aws ecs describe-task-definition \
    --task-definition ${SOURCE_BACKEND_TASK} \
    --query "taskDefinition" \
    --output json \
    --region ${REGION})
  
  FRONTEND_DEF=$(aws ecs describe-task-definition \
    --task-definition ${SOURCE_FRONTEND_TASK} \
    --query "taskDefinition" \
    --output json \
    --region ${REGION})
  
  # Register new task definitions in target environment with updated environment variables
  echo "Registering task definitions in target environment..."
  # Modify environment variables for target environment
  BACKEND_DEF=$(echo ${BACKEND_DEF} | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')
  BACKEND_DEF=$(echo ${BACKEND_DEF} | jq --arg env "${TARGET_ENV}" '.containerDefinitions[0].environment |= map(if .name == "NODE_ENV" then .value = $env else . end)')
  
  FRONTEND_DEF=$(echo ${FRONTEND_DEF} | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')
  FRONTEND_DEF=$(echo ${FRONTEND_DEF} | jq --arg env "${TARGET_ENV}" '.containerDefinitions[0].environment |= map(if .name == "NODE_ENV" then .value = $env else . end)')
  
  # Register new task definitions
  BACKEND_TASK_ARN=$(aws ecs register-task-definition \
    --cli-input-json "${BACKEND_DEF}" \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region ${REGION})
  
  FRONTEND_TASK_ARN=$(aws ecs register-task-definition \
    --cli-input-json "${FRONTEND_DEF}" \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region ${REGION})
  
  # Update services in target environment
  echo "Updating services in target environment..."
  aws ecs update-service \
    --cluster ${TARGET_CLUSTER} \
    --service sewsuite-backend-service \
    --task-definition ${BACKEND_TASK_ARN} \
    --force-new-deployment \
    --region ${REGION}
  
  aws ecs update-service \
    --cluster ${TARGET_CLUSTER} \
    --service sewsuite-frontend-service \
    --task-definition ${FRONTEND_TASK_ARN} \
    --force-new-deployment \
    --region ${REGION}
  
else
  # Standard version restore
  echo "=== Application Restore ==="
  echo "Environment: ${ENVIRONMENT}"
  echo "Version: ${VERSION}"
  
  if [ "$VERSION" = "latest" ]; then
    echo "Restoring to latest stable version..."
    # Find the latest known good version from deployment records
    VERSION=$(cat ./deployment-records/known-good-versions.txt | sort -r | head -n 1)
  fi
  
  # Check if the version exists in ECR
  echo "Verifying image version ${VERSION} exists..."
  aws ecr describe-images \
    --repository-name sewsuite-backend \
    --image-ids imageTag=${VERSION} \
    --region ${REGION} > /dev/null || \
    { echo "Error: Version ${VERSION} does not exist for backend"; exit 1; }
  
  aws ecr describe-images \
    --repository-name sewsuite-frontend \
    --image-ids imageTag=${VERSION} \
    --region ${REGION} > /dev/null || \
    { echo "Error: Version ${VERSION} does not exist for frontend"; exit 1; }
  
  ECR_REGISTRY=$(aws ecr describe-repositories \
    --repository-names sewsuite-backend \
    --query "repositories[0].repositoryUri" \
    --output text \
    --region ${REGION} | sed 's/\/sewsuite-backend//')
  
  # Get current task definitions
  echo "Fetching current task definitions..."
  BACKEND_TASK_DEF=$(aws ecs describe-services \
    --cluster ${CLUSTER} \
    --services ${BACKEND_SERVICE} \
    --query "services[0].taskDefinition" \
    --output text \
    --region ${REGION})
  
  FRONTEND_TASK_DEF=$(aws ecs describe-services \
    --cluster ${CLUSTER} \
    --services ${FRONTEND_SERVICE} \
    --query "services[0].taskDefinition" \
    --output text \
    --region ${REGION})
  
  # Create new task definitions with the specified version
  echo "Creating new task definitions with version ${VERSION}..."
  BACKEND_TASK_DEF_JSON=$(aws ecs describe-task-definition \
    --task-definition ${BACKEND_TASK_DEF} \
    --query "taskDefinition" \
    --output json \
    --region ${REGION})
  
  BACKEND_NEW_DEF=$(echo ${BACKEND_TASK_DEF_JSON} | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' | \
    jq --arg img "${ECR_REGISTRY}/sewsuite-backend:${VERSION}" '.containerDefinitions[0].image = $img')
  
  FRONTEND_TASK_DEF_JSON=$(aws ecs describe-task-definition \
    --task-definition ${FRONTEND_TASK_DEF} \
    --query "taskDefinition" \
    --output json \
    --region ${REGION})
  
  FRONTEND_NEW_DEF=$(echo ${FRONTEND_TASK_DEF_JSON} | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' | \
    jq --arg img "${ECR_REGISTRY}/sewsuite-frontend:${VERSION}" '.containerDefinitions[0].image = $img')
  
  # Register new task definitions
  echo "Registering new task definitions..."
  NEW_BACKEND_TASK_ARN=$(aws ecs register-task-definition \
    --cli-input-json "${BACKEND_NEW_DEF}" \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region ${REGION})
  
  NEW_FRONTEND_TASK_ARN=$(aws ecs register-task-definition \
    --cli-input-json "${FRONTEND_NEW_DEF}" \
    --query "taskDefinition.taskDefinitionArn" \
    --output text \
    --region ${REGION})
  
  # Update the services with new task definitions
  echo "Updating services..."
  aws ecs update-service \
    --cluster ${CLUSTER} \
    --service ${BACKEND_SERVICE} \
    --task-definition ${NEW_BACKEND_TASK_ARN} \
    --force-new-deployment \
    --region ${REGION}
  
  aws ecs update-service \
    --cluster ${CLUSTER} \
    --service ${FRONTEND_SERVICE} \
    --task-definition ${NEW_FRONTEND_TASK_ARN} \
    --force-new-deployment \
    --region ${REGION}
fi

echo "Waiting for services to stabilize..."
aws ecs wait services-stable \
  --cluster ${CLUSTER} \
  --services ${BACKEND_SERVICE} ${FRONTEND_SERVICE} \
  --region ${REGION}

echo "✅ Application restore completed successfully!"