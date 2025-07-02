/**
 * SewSuite SaaS Platform - Infrastructure Variables
 * 
 * This file defines all the variables used in the Terraform configuration,
 * following DevSecOps best practices including:
 * - Proper variable typing and constraints
 * - Comprehensive descriptions
 * - Sensitive data marking
 * - Validation rules where appropriate
 * - Default values where safe
 */

# Infrastructure Configuration

variable "aws_region" {
  description = "AWS region to deploy all resources"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9]$", var.aws_region))
    error_message = "The aws_region must be a valid AWS region identifier."
  }
}

variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, or production."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "Must be a valid CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones to use for resources"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# Database Configuration

variable "postgres_instance_class" {
  description = "Instance class for PostgreSQL RDS instance"
  type        = string
  default     = "db.t3.medium"
}

variable "postgres_allocated_storage" {
  description = "Allocated storage for PostgreSQL RDS instance (GB)"
  type        = number
  default     = 50
  
  validation {
    condition     = var.postgres_allocated_storage >= 20
    error_message = "PostgreSQL allocated storage must be at least 20GB."
  }
}

variable "postgres_max_allocated_storage" {
  description = "Max allocated storage for PostgreSQL RDS instance (GB)"
  type        = number
  default     = 200
  
  validation {
    condition     = var.postgres_max_allocated_storage >= 50
    error_message = "PostgreSQL max allocated storage must be at least 50GB."
  }
}

variable "postgres_multi_az" {
  description = "Enable Multi-AZ deployment for PostgreSQL RDS"
  type        = bool
  default     = true
}

variable "postgres_backup_retention_period" {
  description = "Number of days to retain backups for PostgreSQL RDS"
  type        = number
  default     = 7
  
  validation {
    condition     = var.postgres_backup_retention_period >= 1 && var.postgres_backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Redis Configuration

variable "redis_node_type" {
  description = "Node type for ElastiCache Redis"
  type        = string
  default     = "cache.t3.small"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters for Redis"
  type        = number
  default     = 2
  
  validation {
    condition     = var.redis_num_cache_clusters >= 1 && var.redis_num_cache_clusters <= 6
    error_message = "Number of Redis cache clusters must be between 1 and 6."
  }
}

# Container Configuration

variable "backend_container_cpu" {
  description = "CPU units for backend container (1 vCPU = 1024 units)"
  type        = string
  default     = "1024"
}

variable "backend_container_memory" {
  description = "Memory for backend container (MB)"
  type        = string
  default     = "2048"
}

variable "frontend_container_cpu" {
  description = "CPU units for frontend container (1 vCPU = 1024 units)"
  type        = string
  default     = "512"
}

variable "frontend_container_memory" {
  description = "Memory for frontend container (MB)"
  type        = string
  default     = "1024"
}

variable "backend_desired_count" {
  description = "Desired count of backend containers"
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Desired count of frontend containers"
  type        = number
  default     = 2
}

variable "backend_max_count" {
  description = "Maximum count of backend containers for autoscaling"
  type        = number
  default     = 6
}

variable "frontend_max_count" {
  description = "Maximum count of frontend containers for autoscaling"
  type        = number
  default     = 6
}

variable "backend_cpu_threshold" {
  description = "CPU threshold for backend autoscaling"
  type        = number
  default     = 70
  
  validation {
    condition     = var.backend_cpu_threshold >= 40 && var.backend_cpu_threshold <= 80
    error_message = "CPU threshold should be between 40 and 80 percent."
  }
}

variable "frontend_cpu_threshold" {
  description = "CPU threshold for frontend autoscaling"
  type        = number
  default     = 70
  
  validation {
    condition     = var.frontend_cpu_threshold >= 40 && var.frontend_cpu_threshold <= 80
    error_message = "CPU threshold should be between 40 and 80 percent."
  }
}

# Application Configuration

variable "frontend_url" {
  description = "URL for the frontend application"
  type        = string
  default     = "https://app.sewsuite.co"
  
  validation {
    condition     = can(regex("^https://", var.frontend_url))
    error_message = "Frontend URL must use HTTPS protocol."
  }
}

variable "api_url" {
  description = "URL for the backend API"
  type        = string
  default     = "https://api.sewsuite.co"
  
  validation {
    condition     = can(regex("^https://", var.api_url))
    error_message = "API URL must use HTTPS protocol."
  }
}

# Monitoring & Alerting

variable "alarm_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alarm_email))
    error_message = "Please provide a valid email address for alarms."
  }
}

variable "log_retention_days" {
  description = "Number of days to retain logs in CloudWatch"
  type        = number
  default     = 30
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be one of the allowed values: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653."
  }
}

# Security Configuration - SENSITIVE VALUES

variable "stripe_publishable_key" {
  description = "Stripe publishable key for payment processing"
  type        = string
  sensitive   = false # Publishable key is designed to be public
}

variable "stripe_secret_key" {
  description = "Stripe secret key for payment processing"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret for verifying webhook events"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID for authentication"
  type        = string
  sensitive   = false # Client ID is typically not sensitive
}

variable "google_client_secret" {
  description = "Google OAuth client secret for authentication"
  type        = string
  sensitive   = true
}

variable "email_user" {
  description = "Username for email service authentication"
  type        = string
  sensitive   = true
}

variable "email_password" {
  description = "Password for email service authentication"
  type        = string
  sensitive   = true
}

# Domain & Certificate Configuration

variable "root_domain_name" {
  description = "Root domain name for the application"
  type        = string
  default     = "sewsuite.co"
}

variable "subdomain_frontend" {
  description = "Subdomain for frontend application"
  type        = string
  default     = "app"
}

variable "subdomain_api" {
  description = "Subdomain for backend API"
  type        = string
  default     = "api"
}

# Backup & Recovery Configuration

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for databases"
  type        = bool
  default     = true
}

variable "backup_window" {
  description = "Daily time range during which backups happen"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly time range during which maintenance can occur"
  type        = string
  default     = "sun:04:30-sun:05:30"
}