#!/bin/sh
set -e

# Replace placeholders with environment variables
sed -e "s/RABBITMQ_USER_PLACEHOLDER/${RABBITMQ_USER}/g" \
    -e "s/RABBITMQ_PASSWORD_PLACEHOLDER/${RABBITMQ_PASSWORD}/g" \
    /etc/prometheus/prometheus.yml.template > /etc/prometheus/prometheus.yml

# Execute the original entrypoint
exec /bin/prometheus "$@"