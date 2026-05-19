# microservice-project

A small NestJS microservices monorepo managed with pnpm and Turborepo.

## Services

- **gateway** — HTTP entry point on port `3000`, forwards requests to internal services. On `POST /auth/login` it sets the JWT as an HttpOnly cookie (`auth_token`); body returns `{ userId, role, expiresIn }`. Cookie behavior is configurable via `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE` (defaults: `auth_token`, `true` in production, `lax`).
- **auth** — User signup, login, and JWT issuance. NestJS microservice (gRPC transport) on port `50051`, backed by PostgreSQL. Signs JWTs asymmetrically (`ES256` by default) so other services can verify with the public key, no shared secret. Requires `JWT_PRIVATE_KEY` (PEM, with `\n` escapes) or `JWT_PRIVATE_KEY_PATH`. Optional: `JWT_ALGORITHM` (`ES256`/`ES384`/`RS256`/`RS384`), `JWT_EXPIRES_IN` (seconds, default 3600). Wire contract lives in `@contracts/auth` (`.proto` + zod schemas + typed client interface).

## JWT keys

The auth service signs with a private key; verifiers (future gateway middleware) use the matching public key. Generate a dev keypair before booting docker-compose:

```sh
pnpm keys:gen          # writes .secrets/jwt-dev/{jwt-private,jwt-public}.pem
```

`.secrets/` is gitignored. **Do not use the generated dev keypair in production** — mint keys in your secrets manager.

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
