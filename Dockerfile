FROM node:23-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

RUN npm install -g nodemon

COPY . .

RUN npm run build

CMD npm run start
