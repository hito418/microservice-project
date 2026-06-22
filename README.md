# microservice-project

A small NestJS microservices monorepo managed with pnpm and Turborepo.

## Services

- **gateway** — HTTP entry point on port `3000`, forwards requests to internal services. On `POST /auth/login` it sets the JWT as an HttpOnly cookie (`auth_token`); body returns `{ userId, role, expiresIn }`. Cookie behavior is configurable via `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE` (defaults: `auth_token`, `true` in production, `lax`).
- **auth** — User signup, login, and JWT issuance. NestJS microservice (gRPC transport) on port `50051`, backed by PostgreSQL. Signs JWTs asymmetrically (`ES256` by default) so other services can verify with the public key, no shared secret. Requires `JWT_PRIVATE_KEY` (PEM, with `\n` escapes) or `JWT_PRIVATE_KEY_PATH`. Optional: `JWT_ALGORITHM` (`ES256`/`ES384`/`RS256`/`RS384`), `JWT_EXPIRES_IN` (seconds, default 3600). Wire contract lives in `@contracts/auth` (`.proto` + zod schemas + typed client interface).

## JWT keys

Auth signs JWTs with a **private** key; the gateway verifies them with the matching **public** key. The signing is asymmetric (`ES256` by default), so no shared secret crosses a service boundary — the gateway only ever holds the public key. Keys are read from `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`, or inline via `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (PEM with `\n` escapes).

Generate a dev keypair before booting docker-compose:

```sh
pnpm keys:gen          # writes .secrets/jwt/{private,public}.pem (ES256 / P-256)
pnpm keys:gen --force  # overwrite an existing keypair
```

docker-compose bind-mounts these into the containers automatically — the private key into auth, the public key into the gateway.

### Generating keys manually

`pnpm keys:gen` is just a wrapper around `openssl`. The equivalent ES256 (P-256) keypair:

```sh
mkdir -p .secrets/jwt
# Private key (PKCS#8) — auth uses this to sign
openssl ecparam -name prime256v1 -genkey -noout \
  | openssl pkcs8 -topk8 -nocrypt -out .secrets/jwt/private.pem
# Public key (SPKI), derived from the private key — the gateway uses this to verify
openssl ec -in .secrets/jwt/private.pem -pubout -out .secrets/jwt/public.pem
```

To use RSA (`RS256`/`RS384`) instead, generate an RSA keypair and set `JWT_ALGORITHM` accordingly on both services:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out .secrets/jwt/private.pem
openssl rsa -in .secrets/jwt/private.pem -pubout -out .secrets/jwt/public.pem
```

Supported algorithms: `ES256` (default), `ES384`, `RS256`, `RS384`.

`.secrets/` is gitignored. **Do not use a dev keypair in production** — mint keys in your secrets manager and inject them via env or mounted volumes.

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
