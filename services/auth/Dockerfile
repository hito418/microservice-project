FROM node:23.7.0-alpine AS base

RUN npm install -g corepack@latest \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# --- Prune the workspace to auth + its workspace deps ---
FROM base AS prune
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PNPM_HOME:$PATH

RUN pnpm add -g turbo@^2

COPY . .

RUN turbo prune "@services/auth" --docker

# --- Build, then bundle a self-contained prod deployment ---
FROM base AS build
WORKDIR /app

COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ ./
RUN pnpm turbo run build --filter=@services/auth

# `pnpm deploy` materializes auth + its prod deps (workspace deps inlined)
# into /prod as a single, self-contained package.
RUN pnpm deploy --filter=@services/auth --prod --legacy /prod

# --- Minimal runtime image ---
FROM node:23.7.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /prod ./
COPY --from=prune /app/.secrets ./.secrets

CMD ["node", "dist/main.js"]
