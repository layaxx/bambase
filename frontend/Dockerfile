FROM node:22-alpine AS base
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
WORKDIR /app

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

FROM deps AS builder
COPY . .
RUN yarn build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER node
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
