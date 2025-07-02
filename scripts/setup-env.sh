# filepath: c:\Users\PSXLHP276\sewsuite-saas\scripts\setup-env.sh
#!/bin/bash

# Generate secure random values
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Create environment file from example
cp .env.example .env.production.local

# Replace placeholders with secure values
sed -i "s/REPLACE_WITH_JWT_SECRET/$JWT_SECRET/g" .env.production.local
sed -i "s/REPLACE_WITH_JWT_REFRESH_SECRET/$JWT_REFRESH_SECRET/g" .env.production.local
sed -i "s/REPLACE_WITH_SESSION_SECRET/$SESSION_SECRET/g" .env.production.local

echo "Environment file created with secure random values"
echo "IMPORTANT: You still need to manually update other sensitive values!"