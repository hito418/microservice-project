# microservice-project

A small NestJS microservices monorepo managed with pnpm and Turborepo.

## Services

- **gateway** — HTTP entry point on port `3000`, forwards requests to internal services. On `POST /auth/login` it sets the JWT as an HttpOnly cookie (`auth_token`); body returns `{ userId, role, expiresIn }`. Cookie behavior is configurable via `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE` (defaults: `auth_token`, `true` in production, `lax`).
- **auth** — User signup, login, and JWT issuance. NestJS microservice (gRPC transport) on port `50051`, backed by PostgreSQL. Requires `JWT_SECRET` (and optionally `JWT_EXPIRES_IN`, in seconds; defaults to 3600). Wire contract lives in `@contracts/auth` (`.proto` + zod schemas + typed client interface).

## Layout

```
services/   NestJS apps
packages/   Shared libraries
toolings/   Shared configs (ts-config, oxlint-config)
```

## Requirements

- Node.js 22+
- pnpm 10+
- Docker (optional, for `docker compose`)

## Getting started

```sh
pnpm install
pnpm turbo dev
```

## Run with Docker

```sh
docker compose up --build
```

The gateway will be reachable on `http://localhost:3000`.

## Common commands

```sh
pnpm turbo build       # build all packages
pnpm turbo lint        # lint
pnpm turbo typecheck   # type-check
pnpm turbo test        # run tests
```
