set dotenv-load := false

default:
    @just --list

install:
    bun install

# Next.js + Convex dev server together
dev:
    bun run dev

lint:
    bun run lint

fmt:
    bun run fmt

fmt-check:
    bun run fmt:check

typecheck:
    bun run typecheck

test:
    bun run test

build:
    bun run build

# Everything CI would run
check: fmt-check lint typecheck test

# Demo users, tools and loans (one overdue). Safe to re-run.
seed:
    bunx convex run seed:run

# Signed call to an n8n endpoint, e.g. `just signed GET /n8n/overdue-loans`
signed method path body="":
    bun scripts/signed-request.ts {{method}} {{path}} '{{body}}'
