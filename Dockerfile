# syntax=docker/dockerfile:1
FROM node:14.18-alpine
RUN npm install -g wait-port
WORKDIR /app