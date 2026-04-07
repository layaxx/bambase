FROM node:22-alpine AS base
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Build
FROM deps AS builder
COPY . .
RUN yarn build

# Production image
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/favicon.png ./favicon.png

# SQLite data and uploads live here
VOLUME ["/app/.tmp", "/app/public/uploads"]

EXPOSE 1337

CMD ["yarn", "start"]
