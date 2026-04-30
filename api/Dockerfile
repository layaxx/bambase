# Creating multi-stage build for production
FROM node:22-alpine AS build
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN yarn global add node-gyp && yarn config set network-timeout 600000 -g
WORKDIR /opt/
COPY package.json yarn.lock ./
RUN yarn install --production
ENV PATH=/opt/node_modules/.bin:$PATH
WORKDIR /opt/app
COPY . .
RUN yarn build

# Creating final production image
FROM node:22-alpine
RUN apk add --no-cache vips-dev
ENV NODE_ENV=production
WORKDIR /opt/
COPY --from=build /opt/node_modules ./node_modules
WORKDIR /opt/app
COPY --from=build /opt/app ./
ENV PATH=/opt/node_modules/.bin:$PATH

RUN mkdir -p /opt/app/public/uploads && chown -R node:node /opt/app
USER node
EXPOSE 1337
CMD ["yarn", "start"]