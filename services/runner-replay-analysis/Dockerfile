FROM node:23.7.0-alpine AS base

RUN npm install -g corepack@latest \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

FROM base AS prune
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN pnpm add -g turbo@^2

COPY . .

RUN turbo prune "@services/runner-replay-analysis" --docker

FROM base AS build
WORKDIR /app

COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ ./
RUN pnpm turbo run build --filter=@services/runner-replay-analysis

RUN pnpm deploy --filter=@services/runner-replay-analysis --prod --legacy /prod

FROM node:23.7.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /prod ./

CMD ["node", "dist/main.js"]
