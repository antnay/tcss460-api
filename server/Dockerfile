FROM node:23-alpine

WORKDIR /server-app

# Copy package files and install dependencies
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Install nodemon globally for hot reloading
RUN npm install -g nodemon

# Copy the rest of the application code
COPY server/ ./

# Build the application (if needed for production)
RUN npm run build

# Default command to run the server
CMD if [ "$NODE_ENV" = "production" ]; then \
        echo "Starting production server"; \
        exec npm run start; \
    else \
        echo "Starting development server with hot reload"; \
        exec npm run dev; \
    fi


