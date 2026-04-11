FROM node:22-bullseye-slim

# Install system dependencies and rclone securely via the official installer
RUN apt-get update && apt-get install -y curl unzip fuse3 man-db \
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

# Environment configurations
ENV RCLONE_CONFIG=/root/.config/rclone/rclone.conf
ENV PORT=3001
EXPOSE 3001

# Spin up the backend API, mapped natively to serve the built frontend statics
CMD ["npm", "--prefix", "server", "start"]
