#!/bin/sh
# filepath: c:\Users\PSXLHP276\sewsuite-saas\backend\docker-entrypoint.sh
set -e

# Wait for dependent services if needed
wait_for() {
    echo "Waiting for $1 to be ready..."
    timeout=60
    while ! nc -z $2 $3; do
        timeout=$((timeout-1))
        if [ $timeout -eq 0 ]; then
            echo "Error: Timeout waiting for $1"
            exit 1
        fi
        sleep 1
    done
    echo "$1 is ready!"
}

# Check if database connection is required before startup
if [ "$WAIT_FOR_DB" = "true" ]; then
    wait_for "PostgreSQL" ${POSTGRES_HOST:-db} ${POSTGRES_PORT:-5432}
fi

# Check if Redis connection is required
if [ "$WAIT_FOR_REDIS" = "true" ]; then
    wait_for "Redis" ${REDIS_HOST:-redis} ${REDIS_PORT:-6379}
fi

# Check if RabbitMQ connection is required
if [ "$WAIT_FOR_RABBITMQ" = "true" ]; then
    wait_for "RabbitMQ" ${RABBITMQ_HOST:-rabbitmq} ${RABBITMQ_PORT:-5672}
fi

# Run migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    npm run migration:run
fi

# Generate Swagger docs if needed
if [ "$GENERATE_SWAGGER" = "true" ]; then
    echo "Generating Swagger documentation..."
    npm run swagger
fi

# Run the main container command
exec "$@"