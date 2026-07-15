# Use Node.js LTS (v20) as the base image
FROM node:20-alpine AS build

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

# Copy the local kiteconnect-sdk first, as it is a local dependency in package.json
COPY kiteconnect-sdk ./kiteconnect-sdk

# Install dependencies and build kiteconnect-sdk
WORKDIR /usr/src/app/kiteconnect-sdk
RUN npm install --legacy-peer-deps
RUN npm run build

# Return to root workdir
WORKDIR /usr/src/app

# Copy root package.json and package-lock.json
COPY package.json package-lock.json ./

# Install root dependencies
RUN npm install --legacy-peer-deps

# Copy application files (excluding those in .dockerignore)
COPY . .

# Build the client application (outputs to /usr/src/app/public)
RUN npm run build:client

# Remove development dependencies to keep the image slim
RUN npm prune --production --legacy-peer-deps

# Expose the server port
EXPOSE 3005

# Start the application
CMD ["node", "server.js"]

