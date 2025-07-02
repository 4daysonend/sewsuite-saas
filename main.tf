# main.tf - Modified to use external secrets management

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  required_version = ">= 1.0.0"

  # Backend for state storage should be uncommented for production
  backend "s3" {
    bucket         = "sewsuite-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "sewsuite-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}

# Get secrets from AWS Secrets Manager
data "aws_secretsmanager_secret" "postgres_secret" {
  name = "${var.environment}/sewsuite/postgres"
}

data "aws_secretsmanager_secret_version" "postgres_secret_version" {
  secret_id = data.aws_secretsmanager_secret.postgres_secret.id
}

data "aws_secretsmanager_secret" "mongodb_secret" {
  name = "${var.environment}/sewsuite/mongodb"
}

data "aws_secretsmanager_secret_version" "mongodb_secret_version" {
  secret_id = data.aws_secretsmanager_secret.mongodb_secret.id
}

data "aws_secretsmanager_secret" "redis_secret" {
  name = "${var.environment}/sewsuite/redis"
}

data "aws_secretsmanager_secret_version" "redis_secret_version" {
  secret_id = data.aws_secretsmanager_secret.redis_secret.id
}

data "aws_secretsmanager_secret" "queue_redis_secret" {
  name = "${var.environment}/sewsuite/queue-redis"
}

data "aws_secretsmanager_secret_version" "queue_redis_secret_version" {
  secret_id = data.aws_secretsmanager_secret.queue_redis_secret.id
}

data "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.environment}/sewsuite/jwt"
}

data "aws_secretsmanager_secret_version" "jwt_secret_version" {
  secret_id = data.aws_secretsmanager_secret.jwt_secret.id
}

data "aws_secretsmanager_secret" "rabbitmq_secret" {
  name = "${var.environment}/sewsuite/rabbitmq"
}

data "aws_secretsmanager_secret_version" "rabbitmq_secret_version" {
  secret_id = data.aws_secretsmanager_secret.rabbitmq_secret.id
}

data "aws_secretsmanager_secret" "oauth_secret" {
  name = "${var.environment}/sewsuite/oauth"
}

data "aws_secretsmanager_secret_version" "oauth_secret_version" {
  secret_id = data.aws_secretsmanager_secret.oauth_secret.id
}

data "aws_secretsmanager_secret" "stripe_secret" {
  name = "${var.environment}/sewsuite/stripe"
}

data "aws_secretsmanager_secret_version" "stripe_secret_version" {
  secret_id = data.aws_secretsmanager_secret.stripe_secret.id
}

data "aws_secretsmanager_secret" "email_secret" {
  name = "${var.environment}/sewsuite/email"
}

data "aws_secretsmanager_secret_version" "email_secret_version" {
  secret_id = data.aws_secretsmanager_secret.email_secret.id
}

data "aws_secretsmanager_secret" "aws_secret" {
  name = "${var.environment}/sewsuite/aws-credentials"
}

data "aws_secretsmanager_secret_version" "aws_secret_version" {
  secret_id = data.aws_secretsmanager_secret.aws_secret.id
}

# Parse JSON credentials from secrets manager
locals {
  db_creds        = jsondecode(data.aws_secretsmanager_secret_version.postgres_secret_version.secret_string)
  mongodb_creds   = jsondecode(data.aws_secretsmanager_secret_version.mongodb_secret_version.secret_string)
  redis_creds     = jsondecode(data.aws_secretsmanager_secret_version.redis_secret_version.secret_string)
  queue_redis_creds = jsondecode(data.aws_secretsmanager_secret_version.queue_redis_secret_version.secret_string)
  jwt_config      = jsondecode(data.aws_secretsmanager_secret_version.jwt_secret_version.secret_string)
  rabbitmq_creds  = jsondecode(data.aws_secretsmanager_secret_version.rabbitmq_secret_version.secret_string)
  oauth_creds     = jsondecode(data.aws_secretsmanager_secret_version.oauth_secret_version.secret_string)
  stripe_creds    = jsondecode(data.aws_secretsmanager_secret_version.stripe_secret_version.secret_string)
  email_creds     = jsondecode(data.aws_secretsmanager_secret_version.email_secret_version.secret_string)
  aws_creds       = jsondecode(data.aws_secretsmanager_secret_version.aws_secret_version.secret_string)
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "sewsuite-vpc-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = var.environment
    Project     = "sewsuite"
    Terraform   = "true"
  }
}

# Security Groups
resource "aws_security_group" "alb_sg" {
  name        = "sewsuite-alb-sg-${var.environment}"
  description = "Allow HTTP/HTTPS inbound traffic for ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "sewsuite-alb-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group" "ecs_sg" {
  name        = "sewsuite-ecs-sg-${var.environment}"
  description = "Allow traffic for ECS services"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Traffic from ALB"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "sewsuite-ecs-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group" "database_sg" {
  name        = "sewsuite-db-sg-${var.environment}"
  description = "Allow database traffic"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "DB from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "sewsuite-db-sg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_security_group" "redis_sg" {
  name        = "sewsuite-redis-sg-${var.environment}"
  description = "Allow Redis traffic"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "sewsuite-redis-sg-${var.environment}"
    Environment = var.environment
  }
}

# RDS PostgreSQL Database
resource "aws_db_subnet_group" "postgres" {
  name       = "sewsuite-db-subnet-group-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name        = "sewsuite-db-subnet-group-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "sewsuite-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "14.5"
  instance_class         = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"
  allocated_storage      = var.environment == "production" ? 50 : 20
  max_allocated_storage  = var.environment == "production" ? 200 : 50
  storage_type           = "gp3"
  storage_encrypted      = true
  multi_az               = var.environment == "production"
  db_name                = local.db_creds.database
  username               = local.db_creds.username
  password               = local.db_creds.password
  vpc_security_group_ids = [aws_security_group.database_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  skip_final_snapshot    = var.environment != "production"
  backup_retention_period = var.environment == "production" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:30-sun:05:30"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  tags = {
    Name        = "sewsuite-db-${var.environment}"
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "redis" {
  name       = "sewsuite-redis-subnet-group-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "sewsuite-redis-${var.environment}"
  description                = "SewSuite Redis Cluster"
  node_type                  = var.environment == "production" ? "cache.t3.small" : "cache.t2.micro"
  num_cache_clusters         = var.environment == "production" ? 2 : 1
  port                       = local.redis_creds.port
  parameter_group_name       = "default.redis7"
  engine_version             = "7.0"
  automatic_failover_enabled = var.environment == "production"
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis_sg.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = local.redis_creds.password
  
  tags = {
    Name        = "sewsuite-redis-${var.environment}"
    Environment = var.environment
  }
}

# S3 Bucket for File Storage
resource "aws_s3_bucket" "uploads" {
  bucket = "sewsuite-uploads-${var.environment}"
  
  tags = {
    Name        = "sewsuite-uploads-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "noncurrent-versions-expiration"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ECR Repositories
resource "aws_ecr_repository" "backend" {
  name                 = "sewsuite-backend-${var.environment}"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name        = "sewsuite-backend-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "sewsuite-frontend-${var.environment}"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name        = "sewsuite-frontend-${var.environment}"
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "sewsuite-cluster-${var.environment}"
  
  setting {
    name  = "containerInsights"
    value = var.environment == "production" ? "enabled" : "disabled"
  }
  
  tags = {
    Name        = "sewsuite-cluster-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  
  default_capacity_provider_strategy {
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
    weight            = 1
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "sewsuite-ecs-task-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_manager_access" {
  name = "sewsuite-secrets-manager-access-${var.environment}"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Effect = "Allow"
        Resource = [
          data.aws_secretsmanager_secret.postgres_secret.arn,
          data.aws_secretsmanager_secret.mongodb_secret.arn,
          data.aws_secretsmanager_secret.redis_secret.arn,
          data.aws_secretsmanager_secret.queue_redis_secret.arn,
          data.aws_secretsmanager_secret.jwt_secret.arn,
          data.aws_secretsmanager_secret.rabbitmq_secret.arn,
          data.aws_secretsmanager_secret.oauth_secret.arn,
          data.aws_secretsmanager_secret.stripe_secret.arn,
          data.aws_secretsmanager_secret.email_secret.arn,
          data.aws_secretsmanager_secret.aws_secret.arn
        ]
      }
    ]
  })
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task_role" {
  name = "sewsuite-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "s3_access" {
  name = "sewsuite-s3-access-${var.environment}"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      }
    ]
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/sewsuite-backend-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = {
    Name        = "sewsuite-backend-logs-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/sewsuite-frontend-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = {
    Name        = "sewsuite-frontend-logs-${var.environment}"
    Environment = var.environment
  }
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "backend" {
  family                   = "sewsuite-backend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "production" ? "1024" : "512"
  memory                   = var.environment == "production" ? "2048" : "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "FRONTEND_URL", value = "https://app.sewsuite.co" },
        { name = "POSTGRES_DB", value = local.db_creds.database },
        { name = "POSTGRES_USER", value = local.db_creds.username },
        { name = "POSTGRES_HOST", value = aws_db_instance.postgres.address },
        { name = "POSTGRES_PORT", value = tostring(aws_db_instance.postgres.port) },
        { name = "MONGODB_DATABASE", value = local.mongodb_creds.database },
        { name = "MONGODB_USER", value = local.mongodb_creds.username },
        { name = "MONGODB_HOST", value = local.mongodb_creds.host },
        { name = "MONGODB_PORT", value = tostring(local.mongodb_creds.port) },
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "REDIS_PORT", value = tostring(aws_elasticache_replication_group.redis.port) },
        { name = "REDIS_DB", value = tostring(local.redis_creds.database) },
        { name = "QUEUE_REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "QUEUE_REDIS_PORT", value = tostring(aws_elasticache_replication_group.redis.port) },
        { name = "QUEUE_REDIS_DB", value = tostring(local.queue_redis_creds.database) },
        { name = "RABBITMQ_HOST", value = local.rabbitmq_creds.host },
        { name = "RABBITMQ_PORT", value = tostring(local.rabbitmq_creds.port) },
        { name = "RABBITMQ_VHOST", value = local.rabbitmq_creds.vhost },
        { name = "RABBITMQ_USERNAME", value = local.rabbitmq_creds.username },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.uploads.id },
        { name = "AWS_ACCESS_KEY_ID", value = local.aws_creds.access_key_id },
        { name = "LOG_LEVEL", value = "warn" },
        { name = "BCRYPT_SALT_ROUNDS", value = "12" },
        { name = "JWT_EXPIRATION", value = local.jwt_config.expiresIn },
        { name = "RATE_LIMIT_WINDOW", value = "15" },
        { name = "RATE_LIMIT_MAX_REQUESTS", value = "100" },
        { name = "MAX_FILE_SIZE", value = "5242880" },
        { name = "ALLOWED_FILE_TYPES", value = "image/jpeg,image/png,application/pdf,image/svg+xml" },
        { name = "MAX_FILES_PER_REQUEST", value = "5" },
        { name = "ENABLE_MONITORING", value = "true" },
        { name = "METRICS_INTERVAL", value = "15000" },
        { name = "CACHE_TTL", value = "3600" },
        { name = "CACHE_MAX_ITEMS", value = "10000" },
        { name = "GOOGLE_CLIENT_ID", value = local.oauth_creds.google_client_id },
        { name = "GOOGLE_CALLBACK_URL", value = "https://app.sewsuite.co/auth/google/callback" },
        { name = "EMAIL_SERVICE", value = "ses" },
        { name = "EMAIL_HOST", value = local.email_creds.host },
        { name = "EMAIL_PORT", value = tostring(local.email_creds.port) },
        { name = "EMAIL_USER", value = local.email_creds.username },
        { name = "EMAIL_FROM", value = "notifications@sewsuite.co" },
        { name = "STRIPE_PUBLISHABLE_KEY", value = local.stripe_creds.publishable_key }
      ]
      
      secrets = [
        {
          name      = "POSTGRES_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.postgres_secret.arn}:password::"
        },
        {
          name      = "MONGODB_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.mongodb_secret.arn}:password::"
        },
        {
          name      = "REDIS_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.redis_secret.arn}:password::"
        },
        {
          name      = "QUEUE_REDIS_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.queue_redis_secret.arn}:password::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${data.aws_secretsmanager_secret.jwt_secret.arn}:secret::"
        },
        {
          name      = "RABBITMQ_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.rabbitmq_secret.arn}:password::"
        },
        {
          name      = "AWS_SECRET_ACCESS_KEY"
          valueFrom = "${data.aws_secretsmanager_secret.aws_secret.arn}:secret_access_key::"
        },
        {
          name      = "EMAIL_PASSWORD"
          valueFrom = "${data.aws_secretsmanager_secret.email_secret.arn}:password::"
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = "${data.aws_secretsmanager_secret.stripe_secret.arn}:secret_key::"
        },
        {
          name      = "STRIPE_WEBHOOK_SECRET"
          valueFrom = "${data.aws_secretsmanager_secret.stripe_secret.arn}:webhook_secret::"
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = "${data.aws_secretsmanager_secret.oauth_secret.arn}:google_client_secret::"
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name        = "sewsuite-backend-task-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "sewsuite-frontend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "production" ? "512" : "256"
  memory                   = var.environment == "production" ? "1024" : "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${aws_ecr_repository.frontend.repository_url}:latest"
      essential = true
      
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]
      
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" },
        { name = "API_URL", value = "https://api.sewsuite.co" },
        { name = "NEXT_PUBLIC_API_URL", value = "https://api.sewsuite.co" },
        { name = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", value = local.stripe_creds.publishable_key }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name        = "sewsuite-frontend-task-${var.environment}"
    Environment = var.environment
  }
}

# ALB (Application Load Balancer)
resource "aws_lb" "main" {
  name               = "sewsuite-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = var.environment == "production"
  
  tags = {
    Name        = "sewsuite-alb-${var.environment}"
    Environment = var.environment
  }
}

# ACM Certificate for SSL
resource "aws_acm_certificate" "app" {
  domain_name       = "app.sewsuite.co"
  validation_method = "DNS"
  
  subject_alternative_names = ["www.sewsuite.co", "api.sewsuite.co"]
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name        = "sewsuite-cert-${var.environment}"
    Environment = var.environment
  }
}

# ALB Listeners
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  
  default_action {
    type = "redirect"
    
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.app.arn
  
  default_action {
    type = "fixed-response"
    
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

# ALB Target Groups
resource "aws_lb_target_group" "backend" {
  name        = "sewsuite-backend-tg-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    path                = "/health"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
  
  tags = {
    Name        = "sewsuite-backend-tg-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "frontend" {
  name        = "sewsuite-frontend-tg-${var.environment}"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    path                = "/"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
  
  tags = {
    Name        = "sewsuite-frontend-tg-${var.environment}"
    Environment = var.environment
  }
}

# ALB Listener Rules
resource "aws_lb_listener_rule" "api_host" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
  
  condition {
    host_header {
      values = ["api.sewsuite.co"]
    }
  }
}

resource "aws_lb_listener_rule" "app_host" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
  
  condition {
    host_header {
      values = ["app.sewsuite.co", "www.sewsuite.co"]
    }
  }
}

# ECS Services
resource "aws_ecs_service" "backend" {
  name                               = "sewsuite-backend-${var.environment}"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.environment == "production" ? 2 : 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120
  wait_for_steady_state              = true
  
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_sg.id]
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }
  
  lifecycle {
    ignore_changes = [desired_count]
  }
  
  depends_on = [
    aws_lb_listener.https,
  ]
  
  tags = {
    Name        = "sewsuite-backend-svc-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "frontend" {
  name                               = "sewsuite-frontend-${var.environment}"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.frontend.arn
  desired_count                      = var.environment == "production" ? 2 : 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120
  wait_for_steady_state              = true
  
  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_sg.id]
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3001
  }
  
  lifecycle {
    ignore_changes = [desired_count]
  }
  
  depends_on = [
    aws_lb_listener.https,
  ]
  
  tags = {
    Name        = "sewsuite-frontend-svc-${var.environment}"
    Environment = var.environment
  }
}

# Auto Scaling for ECS Services
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 10
  min_capacity       = var.environment == "production" ? 2 : 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "sewsuite-backend-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "frontend" {
  max_capacity       = 10
  min_capacity       = var.environment == "production" ? 2 : 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_cpu" {
  name               = "sewsuite-frontend-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Route 53 DNS Records
resource "aws_route53_zone" "main" {
  name = "sewsuite.co"
  
  tags = {
    Name        = "sewsuite-zone"
    Environment = var.environment
  }
}

resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.sewsuite.co"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.sewsuite.co"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.sewsuite.co"
  type    = "A"
  
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ACM Certificate Validation
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "backend_cpu_high" {
  alarm_name          = "sewsuite-backend-cpu-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors backend ECS CPU utilization"
  
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }
  
  alarm_actions = var.environment == "production" ? [aws_sns_topic.alarms.arn] : []
  
  tags = {
    Name        = "sewsuite-backend-cpu-alarm-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "backend_memory_high" {
  alarm_name          = "sewsuite-backend-memory-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors backend ECS memory utilization"
  
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }
  
  alarm_actions = var.environment == "production" ? [aws_sns_topic.alarms.arn] : []
  
  tags = {
    Name        = "sewsuite-backend-memory-alarm-${var.environment}"
    Environment = var.environment
  }
}

# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  name = "sewsuite-alarms-${var.environment}"
  
  tags = {
    Name        = "sewsuite-alarms-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.environment == "production" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Variables
variable "environment" {
  description = "Environment name (e.g., dev, staging, production)"
  default     = "production"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  default     = "us-east-1"
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  default     = "alerts@sewsuite.co"
}

# Outputs
output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "api_url" {
  description = "URL of the API"
  value       = "https://api.sewsuite.co"
}

output "app_url" {
  description = "URL of the application"
  value       = "https://app.sewsuite.co"
}

output "db_endpoint" {
  description = "Endpoint of the database"
  value       = aws_db_instance.postgres.address
  sensitive   = true
}

output "redis_endpoint" {
  description = "Endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "backend_ecr_repository_url" {
  description = "URL of the backend ECR repository"
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_ecr_repository_url" {
  description = "URL of the frontend ECR repository"
  value       = aws_ecr_repository.frontend.repository_url
}