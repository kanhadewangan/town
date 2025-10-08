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
RUN npm run build
EXPOSE 3000
CMD ["node", "index.js"]
