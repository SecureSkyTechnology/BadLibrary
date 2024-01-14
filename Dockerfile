FROM node:20

COPY ./src /app
WORKDIR /app
RUN npm install

CMD node app.js