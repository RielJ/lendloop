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
