FROM node:22-bullseye-slim

# Install system dependencies and rclone securely via the official installer
# Added gosu and shadow for PUID/PGID support
RUN apt-get update && apt-get install -y curl unzip fuse3 man-db gosu shadow \
    && curl https://rclone.org/install.sh | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Build the Vite Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 2. Build the Express Backend
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/

# Copy entrypoint script and make it executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment configurations
# Using a neutral path for the config allows easier permission management when running as non-root
ENV RCLONE_CONFIG=/config/rclone.conf
ENV PORT=3001
EXPOSE 3001

# Use entrypoint.sh to handle PUID/PGID switching
ENTRYPOINT ["/entrypoint.sh"]

# Default command passed to the entrypoint
CMD ["npm", "--prefix", "server", "start"]
