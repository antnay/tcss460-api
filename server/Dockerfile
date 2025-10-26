FROM node:23-alpine

WORKDIR /server-app

COPY server/package.json server/package-lock.json ./
RUN npm ci

RUN npm install -g nodemon

COPY server/ .

RUN npm run build

CMD if [ "$NODE_ENV" = "production" ]; then \
        echo "Starting production server"; \
        exec npm run start; \
    else \
        echo "Starting development server with hot reload"; \
        exec npm run dev; \
    fi


