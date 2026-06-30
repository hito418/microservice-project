# AI Debate Arena demo

This guide describes the demo flow for the current integration branch.

## Scope

The demo-ready path uses:

- frontend in `apps/web`
- gateway HTTP API on port `3000`
- auth-service for signup/login
- scoring-service for votes, vote summary, AI analysis, final score, and random recent debate picker

The current branch does not expose HTTP matchmaking, room/message data, profile stats, or leaderboard from the gateway. The frontend keeps clean fallbacks for those screens.

## Start services

Generate JWT keys if they are missing:

```powershell
pnpm.cmd keys:gen
```

Start the backend services needed for the demo:

```powershell
docker compose up --build auth-db scoring-db profile-db auth scoring profile gateway
```

The wider stack can also be started when debate/redis are needed:

```powershell
docker compose up --build auth-db scoring-db profile-db debate-db redis auth scoring profile debate gateway
```

## Seed demo data

Run the seed after the database containers are healthy:

```powershell
.\scripts\seed-demo.ps1
```

Default demo values:

- debate id: `demo-debate-1`
- profile user id: `11111111-1111-1111-1111-111111111111`

The script inserts or updates scoring demo rows for:

- debate
- spectator votes
- completed AI analysis
- final score

It also inserts profile stats only when the `player_stats` table exists. On branches without profile stats, it logs a notice and continues.

## Start frontend

```powershell
pnpm.cmd --filter @apps/web dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend defaults to:

```text
VITE_API_BASE_URL=http://localhost:3000
```

Override if needed:

```powershell
$env:VITE_API_BASE_URL="http://localhost:3000"
pnpm.cmd --filter @apps/web dev
```

## Five-minute flow

1. Open the frontend.
2. Signup or login with a demo account.
3. On the home dashboard, use the prefilled `demo-debate-1` or click `Use demo ids`.
4. Open the debate as spectator.
5. Vote FOR or AGAINST and show the vote summary.
6. Open `/results/demo-debate-1`.
7. Show final score, winner, audience summary, AI summary, and side feedback.
8. Open `/profile/11111111-1111-1111-1111-111111111111` if profile stats are merged.
9. Open `/leaderboard` if ranking-service is merged and running.

## Fallbacks

If random debate returns 404, use the manual `demo-debate-1` input.

If final score returns 404, rerun:

```powershell
.\scripts\seed-demo.ps1
```

If profile stats returns 404 or 500, the profile stats PR stack is not active or the `player_stats` table is absent. Continue with scoring results.

If leaderboard returns 404 or 500, ranking-service is not active in this branch. Continue with the result screen and vote summary.

## Checks

Recommended targeted checks:

```powershell
pnpm.cmd --filter @apps/web typecheck
pnpm.cmd --filter @apps/web build
pnpm.cmd --filter @apps/web lint
pnpm.cmd lint
```

Root `typecheck`, `test`, and `build` can fail on Windows because `grpc-tools/protoc.exe` exits with code `3221225781` during contract generation. This is a known local tooling issue and also affects unchanged contracts such as `contracts/auth`.

## Git hygiene

Do not commit `package-lock.json`. Use explicit staging.
