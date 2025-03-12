# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY . .

# Build web version
RUN npx expo export:web

# Final stage for app image
FROM base

# Install serve
RUN npm install -g serve

# Copy built application
COPY --from=build /app/dist /app/dist

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD ["npx", "serve", "dist", "--listen", "3000", "--single"]
