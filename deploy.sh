#!/bin/bash
set -e

# Create necessary directories
mkdir -p nginx/conf.d nginx/certs nginx/www db/init grafana/provisioning/datasources

# Set executable permissions for scripts
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Setting file permissions..."
  chmod +x backend/docker-entrypoint.sh
  chmod +x prometheus/docker-entrypoint.sh
  chmod +x deploy.sh
fi

# Build and start containers
docker-compose up -d

echo "SewSuite SaaS application deployed successfully!"
echo "Backend API: http://localhost:${PORT:-3000}/api"
echo "API Documentation: http://localhost:${PORT:-3000}/docs"
echo "Frontend: http://localhost:${NGINX_HTTP_PORT:-80}"
echo "Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
echo "Grafana: http://localhost:${GRAFANA_PORT:-3001} (admin/admin)"
echo "MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001} (${AWS_ACCESS_KEY_ID:-sewsuite_minio}/${AWS_SECRET_ACCESS_KEY:-minio_password})"