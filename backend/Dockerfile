# Base build stage - for compiling TypeScript and installing dependencies
FROM node:18 AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create an appropriate logs directory
RUN mkdir -p /var/log/sewsuite

# Set permissions for logs
RUN chown -R node:node /var/log/sewsuite

# Use non-root user
USER node

# Use environment variables from Docker 
# DON'T copy the .env file into production container
CMD ["node", "dist/main"]