# Cross-region disaster recovery configuration

provider "aws" {
  alias  = "primary"
  region = var.primary_region
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

# Create DR bucket in secondary region
resource "aws_s3_bucket" "dr_backup_bucket" {
  provider = aws.dr
  bucket   = "${var.app_name}-backups-${var.environment}"
  
  tags = {
    Name        = "${var.app_name}-backups-${var.environment}"
    Environment = var.environment
  }
}

# Setup bucket replication
resource "aws_s3_bucket_replication_configuration" "replication" {
  provider   = aws.primary
  role       = aws_iam_role.replication.arn
  bucket     = var.source_bucket_id

  rule {
    id       = "backup-replication"
    status   = "Enabled"
    priority = 10

    destination {
      bucket        = aws_s3_bucket.dr_backup_bucket.arn
      storage_class = "STANDARD"
    }
  }
}

# IAM role for replication
resource "aws_iam_role" "replication" {
  provider = aws.primary
  name     = "${var.app_name}-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      },
    ]
  })
}

# IAM policy for replication
resource "aws_iam_policy" "replication" {
  provider = aws.primary
  name     = "${var.app_name}-replication-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [var.source_bucket_arn]
      },
      {
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Effect   = "Allow"
        Resource = ["${var.source_bucket_arn}/*"]
      },
      {
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.dr_backup_bucket.arn}/*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "replication" {
  provider   = aws.primary
  role       = aws_iam_role.replication.name
  policy_arn = aws_iam_policy.replication.arn
}

# RDS snapshot copy
resource "aws_db_snapshot_copy" "weekly_copy" {
  provider               = aws.dr
  source_db_snapshot_identifier = var.latest_snapshot_arn
  target_db_snapshot_identifier = "${var.app_name}-dr-snapshot-${var.environment}-${formatdate("YYYY-MM-DD", timestamp())}"
  copy_tags              = true
  
  tags = {
    Name        = "${var.app_name}-dr-snapshot-${var.environment}"
    Environment = var.environment
    CreatedBy   = "terraform"
    DrCopy      = "true"
  }
  
  # Run weekly
  lifecycle {
    create_before_destroy = true
    ignore_changes        = [source_db_snapshot_identifier]
    prevent_destroy       = false
  }
}