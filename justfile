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

# Create n8n/.env (shared secret from .env.local, fresh encryption key) and point Convex at n8n
n8n-env:
    #!/usr/bin/env bash
    set -euo pipefail
    secret=$(grep '^LENDLOOP_WEBHOOK_SECRET=' .env.local | cut -d= -f2-)
    if [ -z "$secret" ]; then
      secret=$(openssl rand -hex 32)
      echo "LENDLOOP_WEBHOOK_SECRET=$secret" >> .env.local
    fi
    if [ ! -f n8n/.env ]; then
      sed -e "s|^N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)|" \
          -e "s|^LENDLOOP_WEBHOOK_SECRET=.*|LENDLOOP_WEBHOOK_SECRET=$secret|" \
          n8n/.env.example > n8n/.env
      echo "Wrote n8n/.env"
    fi
    bunx convex env set LENDLOOP_WEBHOOK_SECRET "$secret" > /dev/null
    bunx convex env set N8N_WEBHOOK_URL http://localhost:5678/webhook/lendloop/loan-events > /dev/null
    echo "Convex env: LENDLOOP_WEBHOOK_SECRET and N8N_WEBHOOK_URL set"

# Start n8n + Mailpit, then import and publish the workflows
n8n-up: n8n-env
    docker compose up -d
    until curl -sf http://localhost:5678/healthz/readiness > /dev/null; do sleep 1; done
    just n8n-import
    @echo "n8n: http://localhost:5678  Mailpit: http://localhost:8025"

# Import the SMTP credential and workflows from n8n/, then publish them
n8n-import:
    docker compose exec -T n8n n8n import:credentials --input=/lendloop/credentials/mailpit-smtp.json
    docker compose exec -T n8n n8n import:workflow --separate --input=/lendloop/workflows
    for f in n8n/workflows/*.json; do \
      docker compose exec -T n8n n8n publish:workflow --id="$(jq -r .id "$f")"; \
    done

# Write the workflows edited in the n8n UI back to n8n/workflows
# (keeps only the portable fields, so the files don't carry instance IDs or timestamps)
n8n-export:
    for f in n8n/workflows/*.json; do \
      docker compose exec -T n8n n8n export:workflow --id="$(jq -r .id "$f")" --output=/tmp/export.json > /dev/null && \
      docker compose exec -T n8n cat /tmp/export.json \
        | jq '.[0] | {id, name, active: false, nodes, connections, settings, pinData, tags: []}' > "$f"; \
    done
    just check-secrets

n8n-down:
    docker compose down

# Fail if any local secret value appears in a file git would commit
check-secrets:
    #!/usr/bin/env bash
    set -uo pipefail
    found=0
    for file in .env.local n8n/.env; do
      [ -f "$file" ] || continue
      while IFS='=' read -r name value; do
        [ ${#value} -ge 16 ] || continue
        if git grep -q --untracked -F -e "$value" -- . ':!*.lock'; then
          echo "Secret $name from $file appears in:"
          git grep -l --untracked -F -e "$value" -- . ':!*.lock'
          found=1
        fi
      done < <(grep -E '^[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)[A-Z_]*=' "$file")
    done
    [ $found -eq 0 ] && echo "No secrets in tracked or untracked files"
    exit $found
