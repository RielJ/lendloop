# LendLoop

A neighborhood tool-lending app. Neighbors list tools, request to borrow them for a date range, and the owner
approves, declines and marks them returned. n8n emails each party when a loan changes state and sends daily
reminders for overdue loans.

**Stack:** Next.js 16 (App Router), Convex (database, server functions, HTTP endpoints), Clerk (sign-in), n8n
(automations), Mailpit (local email inbox), Tailwind and shadcn/ui. Bun runs scripts and tests, and `just` holds the
common commands.

## Contents

- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Roles and permissions](#roles-and-permissions)
- [n8n workflows](#n8n-workflows)
- [Security and data minimization](#security-and-data-minimization)
- [Reliability](#reliability)
- [What I would change for production](#what-i-would-change-for-production)

## Run it locally

**New to the stack? Follow [SETUP.md](SETUP.md).** It walks through every step, including the Clerk dashboard, the
first-run prompts, and what each command prints. The short version:

You need Node 26 (see `.node-version`), Bun 1.4, Docker Desktop, [`just`](https://github.com/casey/just) and `jq`,
plus a free Clerk account.

1. Install dependencies and create the env file:

   ```sh
   bun install
   cp .env.example .env.local
   ```

2. In the [Clerk dashboard](https://dashboard.clerk.com), create an application and copy its two API keys into
   `.env.local`. Then [activate the Convex integration](https://dashboard.clerk.com/apps/setup/convex) and copy the
   **Frontend API URL** it shows. On the [Sessions](https://dashboard.clerk.com/~/sessions) page, add
   `"email": "{{user.primary_email_address}}"` and `"name": "{{user.full_name}}"` to the session token claims next to
   `"aud": "convex"`. Without the email claim, sign-in stops with an error that says so.

3. In terminal 1, start Convex and Next.js. On the first run, choose **Start without an account (run Convex
   locally)**: the n8n setup expects Convex on `localhost`. The first push stops with "Environment variable
   CLERK_JWT_ISSUER_DOMAIN ... was not set". That is expected; leave it running.

   ```sh
   just dev
   ```

4. In terminal 2, set the Clerk issuer and the admin allowlist. Terminal 1 picks them up by itself and starts the app
   at <http://localhost:3000>.

   ```sh
   bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
   bunx convex env set ADMIN_EMAILS you@example.com
   ```

5. With `just dev` still running, start n8n and Mailpit. This creates `n8n/.env`, generates the shared HMAC secret,
   sets `LENDLOOP_WEBHOOK_SECRET` and `N8N_WEBHOOK_URL` on the Convex deployment, and imports and publishes the three
   workflows:

   ```sh
   just n8n-up
   ```

6. Optional: load demo data. It adds three neighbors with `@example.com` addresses, five tools, a pending request, an
   overdue loan and a returned loan. Running it again changes nothing.

   ```sh
   just seed
   ```

### Try it

| What                         | Where                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| App                          | <http://localhost:3000>. Sign in with the email from `ADMIN_EMAILS` to see the Admin tab.                    |
| Emails that n8n sends        | Mailpit at <http://localhost:8025>                                                                           |
| Workflows and executions     | n8n at <http://localhost:5678>. It asks you to create an owner account on the first visit.                   |
| Overdue reminders now        | Open **LendLoop: overdue reminders** in n8n and click **Execute workflow**. It also runs daily at 09:00 UTC. |
| Call an n8n endpoint by hand | `just signed GET /n8n/overdue-loans`                                                                         |

### Commands

| Command              | What it does                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `just check`         | Format check, lint, typecheck and unit tests. Run this before you commit.                      |
| `bun run build`      | Typecheck and production build.                                                                |
| `just n8n-export`    | Writes workflows you edited in the n8n UI back to `n8n/workflows/`, then runs `check-secrets`. |
| `just n8n-import`    | Imports and publishes the workflows from `n8n/workflows/` again.                               |
| `just check-secrets` | Fails if a secret from `.env.local` or `n8n/.env` appears in any file that git would commit.   |
| `just n8n-down`      | Stops n8n and Mailpit. The n8n data volume is kept.                                            |

## Environment variables

No secret is in the code or the workflow JSON. Each value lives in exactly one of three places.

| Variable                                                                     | Where it is set                        | Purpose                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` (written by `convex dev`) | Which Convex deployment the app and scripts use.                                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`                      | `.env.local`                           | Clerk sign-in.                                                                     |
| `LENDLOOP_WEBHOOK_SECRET`                                                    | `.env.local`, Convex env, `n8n/.env`   | Shared HMAC secret for both directions. `just n8n-env` keeps all three in sync.    |
| `CLERK_JWT_ISSUER_DOMAIN`                                                    | Convex env                             | Clerk Frontend API URL. Convex uses it to check sign-in tokens.                    |
| `ADMIN_EMAILS`                                                               | Convex env                             | Comma-separated emails that get the admin role at sign-in.                         |
| `N8N_WEBHOOK_URL`                                                            | Convex env                             | The n8n webhook for loan events.                                                   |
| `N8N_ENCRYPTION_KEY`                                                         | `n8n/.env`                             | Encrypts the credentials stored in n8n. Generated once; back it up.                |
| `CONVEX_SITE_URL`                                                            | `n8n/.env`                             | Where n8n reaches the Convex HTTP endpoints (`host.docker.internal:3211` locally). |
| `ALERT_EMAIL`                                                                | `n8n/.env`                             | Who the error workflow emails.                                                     |

The Convex variables are declared with types in `convex/convex.config.ts`. `.env.local` and `n8n/.env` are
gitignored. The SMTP credential in `n8n/credentials/` holds only the Mailpit host and port. It has no password.

## Architecture

```text
 Browser (Next.js + Clerk)
     │  queries / mutations over WebSocket, Clerk JWT
     ▼
 Convex ── tables: users, tools, loans, automationEvents
     │
     │ 1. A mutation changes a loan, then schedules notify.sendLoanEvent
     │    (internal action, runs after the mutation commits)
     │       POST, HMAC-signed ──────────────────►  n8n  "loan notifications"
     │                                               verify signature → email → 200
     │
     │ 2. Daily at 09:00 UTC                         n8n  "overdue reminders"
     │    GET  /n8n/overdue-loans   ◄─── signed ───  fetch loans not yet reminded today
     │    POST /n8n/reminders       ◄─── signed ───  email each borrower, report sent/failed
     │
     └── automationEvents: one row per notification or reminder,
         shown under each loan as "Reminder sent 2 days ago"

 Any n8n failure ──► n8n "error alerts" ──► email to ALERT_EMAIL
```

Where the main pieces live:

| Path                                                    | Contents                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `convex/lib/rules.ts`                                   | Pure permission and validation rules, unit tested. Every mutation calls them.        |
| `convex/lib/auth.ts`                                    | `requireUser` and `requireAdmin`.                                                    |
| `convex/lib/hmac.ts`                                    | HMAC-SHA256 signing and constant-time verification with a 5-minute timestamp window. |
| `convex/tools.ts`, `convex/loans.ts`, `convex/users.ts` | Public queries and mutations.                                                        |
| `convex/notify.ts`                                      | Convex → n8n: builds the minimal payload, signs it, sends it and retries.            |
| `convex/http.ts`, `convex/overdue.ts`                   | n8n → Convex: the two signed HTTP endpoints.                                         |
| `convex/automation.ts`                                  | Records each automation result idempotently, keyed by event.                         |
| `n8n/workflows/`                                        | The three exported workflows.                                                        |
| `components/dashboard/`                                 | Dashboard tabs: All tools, My listings, My requests, Incoming, and Admin.            |

## Roles and permissions

Convex enforces every rule on the server. The UI hides actions a user can't take, but the server would reject them
anyway.

| Action                                                                  | Signed out | User                                    | Admin             |
| ----------------------------------------------------------------------- | ---------- | --------------------------------------- | ----------------- |
| See available tools (name and category only)                            | ✅         | ✅                                      | ✅                |
| Browse tools with condition, owner name, Trusted badge and availability | —          | ✅                                      | ✅                |
| List a tool                                                             | —          | ✅                                      | ✅                |
| Edit a listing                                                          | —          | Own only                                | Own only          |
| Remove a listing                                                        | —          | Own, when not on loan                   | Any, even on loan |
| Request to borrow                                                       | —          | Others' tools that are not on loan      | Same as a user    |
| Approve or decline a request                                            | —          | Requests for own tools                  | Same as a user    |
| Mark a loan returned                                                    | —          | Loans of own tools                      | Same as a user    |
| See loans                                                               | —          | Own requests and requests for own tools | All loans         |
| See neighbors' emails                                                   | —          | —                                       | ✅ (user list)    |
| Mark a lender Trusted                                                   | —          | —                                       | ✅                |

Admins remove listings but can't edit them, so an admin can't change what a neighbor posted. Removing a listing
declines its pending requests and notifies the borrowers. The role comes only from `ADMIN_EMAILS` on the server. It is
checked again at every sign-in, so removing an email from the list demotes that admin the next time they sign in.

## n8n workflows

Docker Compose runs n8n 2.47.4 and Mailpit on `127.0.0.1` only. `just n8n-up` imports the workflows and publishes
them.

**LendLoop: loan notifications** (`loan-notifications.json`)
Webhook (raw body) → verify the HMAC signature → if valid, compose a short message → email the recipient → reply 200.
An invalid or stale signature gets a 401 and sends no email. The owner gets an email for new requests. The borrower
gets one for approved, declined and returned.

**LendLoop: overdue reminders** (`overdue-reminders.json`)
Daily at 09:00 UTC, or on demand → signed GET of overdue loans → one email per loan → signed POST of the result
(`sent` or `failed`) for each loan. An email failure takes the node's error output, so the failure is still reported
to Convex and doesn't stop the other reminders.

**LendLoop: error alerts** (`error-alerts.json`)
The other two workflows name it as their error workflow. It emails `ALERT_EMAIL` the workflow name, the failed node,
the error message and a link to the execution. It doesn't include the loan data.

## Security and data minimization

**Signing in both directions.** Every request between Convex and n8n carries `x-lendloop-timestamp` and
`x-lendloop-signature: sha256=HMAC(secret, "<timestamp>.<raw body>")`. Both sides check the signature with a
constant-time comparison and reject timestamps more than 5 minutes off. The signature covers the raw bytes, not
re-serialized JSON, so a payload that parses the same but has different bytes doesn't pass. Neither side uses the
body until the signature checks out, and an invalid one gets a 401. The Convex endpoints also return 400 for a
malformed body and 404 for an unknown loan.

**Server-side authorization.** No query or mutation trusts an ID or role from the client. Each one loads the
signed-in user from the Clerk token and checks the rule in `convex/lib/rules.ts`. The notification functions are
internal, so a browser can't call them.

**Each audience sees only what it needs.**

- Signed-out visitors see the name and category of available tools.
- Signed-in neighbors also see condition, description and the owner's name and Trusted badge. They never see other
  users' emails.
- Admins see emails, because they need to tell users apart.
- The Convex → n8n payload carries the event, the tool name, the dates, the status, the recipient's name and email,
  and the other party's name. The other party's email is never sent.
- The overdue list carries only the borrower's name and email, the owner's name, the tool and the dates.
- n8n doesn't save data for successful executions of these workflows. It keeps failed executions for 7 days so you
  can debug them, then deletes them.
- Error alerts name the failure but don't copy the payload.

**Secrets.** The secrets live in the gitignored `.env.local` and `n8n/.env`, and in the Convex deployment's
environment. The workflows read the HMAC secret from `$env`, so the exported JSON contains none.
`just check-secrets` fails if a secret value appears in any file git would commit, and `just n8n-export` runs it
after every export.

## Reliability

| Failure                                             | What happens                                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n8n is down or returns an error when a loan changes | Convex retries after 30 s, 60 s and 120 s, each with a 10 s timeout. If all fail, the loan shows "Gave up after 4 attempts: …".                                                                |
| The SMTP send fails inside n8n                      | The email node tries 3 times, 5 s apart. If it still fails, n8n returns 500 (so Convex retries) and the error workflow sends an alert.                                                         |
| A reminder email fails                              | The failure is written back to Convex as `failed` and shown on the loan. Only loans reminded with `sent` that day are skipped, so the next run tries again.                                    |
| Convex is unreachable from n8n                      | The HTTP nodes try 3 times. Then the error workflow sends an alert.                                                                                                                            |
| The same write-back arrives twice                   | Each result is keyed (`reminder:<loan>:<date>`, `notification:<loan>:<event>`). A repeat updates the existing row and doesn't add one. For reminders, a late `failed` never overwrites `sent`. |
| Two neighbors request the same tool                 | Approving one sets the tool's `activeLoanId`, so a second approval fails with "This tool is already on loan".                                                                                  |

The latest result for each loan appears under the loan in the UI ("Reminder sent 2 days ago", with the detail on
hover), so a failed delivery is visible.

## What I would change for production

- **Email:** a real provider (Postmark, SES) with its key in an n8n credential, instead of Mailpit.
- **n8n hosting:** TLS through a reverse proxy, secure cookies, Postgres instead of SQLite, and a backed-up
  encryption key. External task runners to isolate Code nodes. Only operators can edit workflows, because any editor
  can read `$env`.
- **Secrets:** one secret for each direction, and support for two active secrets at a time so they can be rotated
  without downtime.
- **Replay:** the 5-minute window allows a replay inside it. Write-backs are idempotent, so a replay there is
  harmless. A replayed notification could send a duplicate email, so n8n would store the `key` it receives and drop
  repeats.
- **Identity:** grant admin only when the email is verified (`email_verified` claim), and store the role in Clerk's
  private metadata instead of an email list.
- **Alerts:** send alerts to Slack or PagerDuty, and add an admin view that lists failed automations with a Retry
  button.
- **Scale:** queries cap results at 100 to 200 rows. Real data needs pagination and search, and the public list needs
  rate limiting.
- **Time zones:** "overdue" uses UTC dates. A real app would store each neighborhood's time zone.
- **Tests and CI:** run `just check` and `bun run build` in CI. Add Convex function tests with `convex-test`, and
  end-to-end tests of the sign-in and borrowing flow with Playwright and Clerk testing tokens.
