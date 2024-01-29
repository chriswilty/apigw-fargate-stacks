FROM node:lts-alpine
WORKDIR /usr/app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
RUN npm run build
CMD ["./node_modules/.bin/tsx", "-r", "dotenv/config", "server.ts"]
