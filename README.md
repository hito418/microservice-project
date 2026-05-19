# microservice-project

A small NestJS microservices monorepo managed with pnpm and Turborepo.

## Services

- **gateway** — HTTP entry point on port `3000`, forwards requests to internal services.
- **fibonacci** — Computes Fibonacci numbers, exposed on port `3001`.
- **auth** — User signup / login, JWT issuance. NestJS microservice (gRPC transport) on port `50051`, backed by PostgreSQL. Wire contract lives in `@contracts/auth` (`.proto` + zod schemas + typed client interface).

## Layout

```
services/   NestJS apps (gateway, fibonacci)
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
