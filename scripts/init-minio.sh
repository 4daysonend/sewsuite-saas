#!/bin/bash

# Wait for MinIO to be ready
sleep 5

# Create buckets
mc config host add sewsuite-minio http://minio:9000 minioadmin minioadmin
mc mb --ignore-existing sewsuite-minio/sewsuite-files

# Set public read policy for the files bucket (if needed)
mc policy set download sewsuite-minio/sewsuite-files