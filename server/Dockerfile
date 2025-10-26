# ==========================
# Stage 1 — Base Environment
# ==========================
FROM node:23-alpine AS base

WORKDIR /server-app

# Copy only package files first (for caching)
COPY package*.json ./
RUN npm ci

RUN npm install -g nodemon

# ==========================
# Stage 2 — Development
# ==========================
FROM base AS development

# Copy source code
COPY . .

CMD ["npm", "run", "dev"]


# ==========================
# Stage 3 — Production
# ==========================
FROM base AS production

ENV NODE_ENV=production

# Copy all files for building
COPY . .

# Build the project
RUN npm run build

# Clean up dev dependencies
RUN npm prune --production

# Run the built app
CMD ["npm", "run", "start"]
