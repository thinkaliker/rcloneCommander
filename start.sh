#!/bin/bash

# Source user profiles in case node is managed by nvm or similar tools in interactive shells
source ~/.bash_profile 2>/dev/null
source ~/.zshrc 2>/dev/null
source ~/.bashrc 2>/dev/null

# 1. Check & Install Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is not found on your system."
    echo "Attempting to install Node.js via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "Error: Homebrew is not installed. Please install Node.js manually from https://nodejs.org/"
        exit 1
    fi
    brew install node
else
    echo "Node.js is found: $(command -v node) (Version: $(node -v))"
fi

# 2. Check & Install Dependencies
echo "Ensuring frontend dependencies are installed..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo "Ensuring server dependencies are installed..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 3. Start Both Services
echo "Starting Express backend on port 3001..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

echo "Starting Vite frontend on port 5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# 4. Graceful Shutdown
# Trap Ctrl+C (SIGINT) to kill both the background server and frontend gracefully
trap "echo -e '\nShutting down both servers...'; kill $SERVER_PID; kill $FRONTEND_PID; exit 0" SIGINT SIGTERM

echo "================================================="
echo "rcloneCommander is running!"
echo "Backend active at  -> http://localhost:3001"
echo "Frontend active at -> http://localhost:5173"
echo "Press Ctrl+C to stop both servers."
echo "================================================="

# Wait indefinitely until interrupted
wait
