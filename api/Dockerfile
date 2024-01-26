FROM node:lts-alpine
WORKDIR /usr/app
# TODO Work out what to include here... Maybe we need independent modules
COPY package*.json ./
#RUN yarn install
COPY . .
EXPOSE 3000
RUN yarn build
CMD ["tsx", "-r", "dotenv/config", "server.ts"]
