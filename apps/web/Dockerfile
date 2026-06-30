FROM node:23.7.0-alpine AS base

RUN npm install -g corepack@latest \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# --- Prune the workspace to web + its workspace deps ---
FROM base AS prune
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PNPM_HOME:$PATH

RUN pnpm add -g turbo@^2

COPY . .

RUN turbo prune "@apps/web" --docker

# --- Build the static bundle ---
FROM base AS build
WORKDIR /app

# Vite inlines import.meta.env.VITE_* at build time, so the gateway URL the
# browser will call must be baked in here. Defaults to the gateway's published
# host port; override at build with --build-arg VITE_API_BASE_URL=...
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY --from=prune /app/out/json/ ./
RUN pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ ./
RUN pnpm turbo run build --filter=@apps/web

# --- Serve the static files ---
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
