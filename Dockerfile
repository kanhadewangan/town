#build stage

FROM node:alpine

WORKDIR /app

COPY package*.json ./
RUN  npm ci

#production stage
FROM node:alpine

WORKDIR /app

COPY package*.json ./
RUN  npm ci --only=production
COPY --from=0 /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "backend/index.js"]