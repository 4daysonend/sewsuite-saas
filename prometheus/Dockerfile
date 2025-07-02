FROM prom/prometheus:latest

USER root

# Copy configuration template and entrypoint script
COPY prometheus.yml.template /etc/prometheus/prometheus.yml.template
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Set permissions
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch back to non-root user
USER nobody

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]