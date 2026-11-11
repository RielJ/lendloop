# LendLoop setup guide

This guide takes you from a fresh clone to a working LendLoop on your machine: sign-in, listing and borrowing tools,
emails sent by n8n, and overdue reminders. Each step says what to do, why, and what you should see. Plan for 20 to 30
minutes, most of it waiting for downloads. I tested these steps on macOS.

## What you are setting up

Everything runs on your machine except Clerk, which handles sign-in.

| Piece       | What it does                                    | Where it runs                       | Address                                    |
| ----------- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------ |
| Next.js app | The website                                     | Your machine, started by `just dev` | <http://localhost:3000>                    |
| Convex      | Database and server functions                   | Your machine, started by `just dev` | Ports 3210 (API) and 3211 (HTTP endpoints) |
| n8n         | Sends the emails and runs the daily reminder    | Docker, started by `just n8n-up`    | <http://localhost:5678>                    |
| Mailpit     | A fake inbox that catches every email n8n sends | Docker, started by `just n8n-up`    | <http://localhost:8025>                    |
| Clerk       | Sign-in                                         | Online, at clerk.com                | <https://dashboard.clerk.com>              |

No real email is sent. Every email, whatever the address, lands in Mailpit.

You will use two terminal windows:

- **Terminal 1** runs `just dev` the whole time. Don't close it.
- **Terminal 2** is for one-off commands.

Run every command from the project folder.

## Step 1: Install the tools

Check each tool. If a command fails or prints an older version, install the tool with the command in the last column
(macOS with [Homebrew](https://brew.sh)).

| Tool           | Check                    | You need           | Install                                                               |
| -------------- | ------------------------ | ------------------ | --------------------------------------------------------------------- |
| Node.js        | `node -v`                | `v26.x`            | `brew install fnm`, then `fnm install 26`. fnm reads `.node-version`. |
| Bun            | `bun -v`                 | `1.4.x`            | `curl -fsSL https://bun.sh/install \| bash`                           |
| Docker Desktop | `docker compose version` | Any recent version | Download from <https://www.docker.com/products/docker-desktop/>       |
| just           | `just --version`         | Any                | `brew install just`                                                   |
| jq             | `jq --version`           | Any                | `brew install jq`                                                     |

`git`, `curl` and `openssl` come with macOS.

Start Docker Desktop now and leave it running. The whale icon in the menu bar shows it is up. Step 7 needs it.

## Step 2: Get the code

```sh
git clone <repo-url> lendloop
cd lendloop
bun install
cp .env.example .env.local
```

- `bun install` downloads the dependencies and ends with a line like `N packages installed`.
- `.env.local` holds your keys. Git ignores it, so it never leaves your machine. The next steps fill it in.

## Step 3: Create the Clerk application (online)

Clerk shows the sign-in screen and tells Convex who is signed in. The free development plan is enough.

### 3.1 Create the application

1. Go to <https://dashboard.clerk.com> and sign up or log in.
2. Click **Create application**.
3. For **Application name**, enter `LendLoop`.
4. Under the sign-in options, keep **Email** turned on. You can also turn on Google or others if you want.
5. Click **Create application**.

### 3.2 Copy the API keys into `.env.local`

1. Open the **API keys** page: <https://dashboard.clerk.com/last-active?path=api-keys>.
2. In **Quick Copy**, choose **Next.js**. Two lines appear:

   ```sh
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

3. Open `.env.local` in your editor. Replace the two empty Clerk lines with the two you copied, then save.

The `pk_test_` key is public; the browser uses it. The `sk_test_` key is a secret. Don't share it or commit it.

### 3.3 Turn on the Convex integration

1. Open <https://dashboard.clerk.com/apps/setup/convex>. If Clerk asks, choose your LendLoop application.
2. Click **Activate Convex integration**.
3. The page now shows a **Frontend API URL** like `https://verb-noun-12.clerk.accounts.dev`. Copy it; you need it in
   Step 5.

This creates a token template named `convex` in Clerk. The app asks Clerk for a token from that template and sends it
to Convex. If you skip this step, sign-in seems to work, but the browser console shows `404` errors for
`/tokens/convex` and the dashboard never loads your data.

> **If you ran the app before adding Clerk keys:** Clerk may have created a temporary app for you without an account
> (keyless mode). Its keys and a claim link are in `.clerk/.tmp/keyless.json`. You can open the `claimUrl` while logged
> in to Clerk to move that app into your account, put its keys in `.env.local`, and continue with 3.3. Or ignore it and
> use the app you created in 3.1.

## Step 4: Start Convex and the app (Terminal 1)

```sh
just dev
```

This runs Convex and Next.js together. The first run asks two questions:

1. `Welcome to Convex! Would you like to login to your account?`
   Choose **Start without an account (run Convex locally)**. A local deployment is what n8n expects: n8n runs in Docker
   and reaches Convex on your machine. With a cloud deployment, the n8n setup in Step 7 would need a different URL.
2. `Project name:` Type `lendloop` and press Enter.

Convex then writes the three `CONVEX_*` lines into `.env.local` and starts a local backend on port 3210. Then it stops
with this message:

```text
Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set.
```

**This is expected.** Convex doesn't know your Clerk app yet. Leave Terminal 1 running. Convex retries by itself after
you set the variable in Step 5.

On later runs, Convex may ask `Would you like to link it now?`. Answer **No**. Linking is only for Convex accounts, and
your local data stays where it is either way.

## Step 5: Tell Convex about Clerk and your admin email (Terminal 2)

Open a second terminal in the project folder and run these two commands. Use your own values.

```sh
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://verb-noun-12.clerk.accounts.dev
bunx convex env set ADMIN_EMAILS you@example.com
```

- `CLERK_JWT_ISSUER_DOMAIN` is the Frontend API URL from Step 3.3. Paste it exactly, with `https://` and no slash at
  the end. Convex uses it to check that sign-in tokens really come from your Clerk app.
- `ADMIN_EMAILS` is the email you will sign in with. Users with these emails get the admin role. For several admins,
  separate the emails with commas: `a@example.com,b@example.com`.

Each command prints `✔ Successfully set ...`. Now look at Terminal 1. Within a few seconds it shows:

```text
✔ Convex functions ready!
▲ Next.js 16.x
- Local:         http://localhost:3000
✓ Ready
```

To check the settings at any time, run `bunx convex env list`.

## Step 6: Sign in

1. Open <http://localhost:3000>. The home page has an **Available now** list, which is empty for now.
2. Click **Sign in to lend or borrow**, then **Sign up**. Use the email you put in `ADMIN_EMAILS`. Clerk emails you a
   code; enter it.
3. Click **Dashboard** in the header. You see the tabs **All tools**, **My listings**, **My requests**, **Incoming**,
   and **Admin**.

If the **Admin** tab is missing, the email doesn't match `ADMIN_EMAILS`. Fix the value with the command from Step 5,
then sign out (your avatar, top right) and sign in again. The role is set at each sign-in.

## Step 7: Start n8n and Mailpit (Terminal 2)

Make sure Docker Desktop is running and `just dev` is still running in Terminal 1. Then run:

```sh
just n8n-up
```

This command:

1. Generates a shared secret that Convex and n8n use to sign their messages to each other, and adds it to
   `.env.local`.
2. Writes `n8n/.env` (gitignored) with that secret and a new n8n encryption key.
3. Tells Convex where to send loan events (`N8N_WEBHOOK_URL`) and gives it the shared secret.
4. Starts n8n and Mailpit in Docker. The first time, Docker downloads the images, which can take a few minutes.
5. Imports the Mailpit email credential and the three workflows, and publishes them so they run.

It ends with:

```text
n8n: http://localhost:5678  Mailpit: http://localhost:8025
```

Now open both:

- **n8n** (<http://localhost:5678>): the first visit asks you to set up an owner account. Enter any name, email and
  password. The account exists only in your local n8n. Then open **Overview** or **Workflows**. You see three
  workflows: **LendLoop: loan notifications**, **LendLoop: overdue reminders**, and **LendLoop: error alerts**.
- **Mailpit** (<http://localhost:8025>): an empty inbox. Keep this tab open.

## Step 8: Add demo data (optional)

```sh
just seed
```

The first run prints `"added": 3` (the number of loans it created). Running it again prints `"added": 0` and changes
nothing.

It adds three neighbors (Maya, Sam and Lee, with `@example.com` emails), five tools, and three loans: a pending
request, an overdue loan (Lee has Maya's **Extension ladder**), and a returned loan. You can't sign in as these
neighbors. They are there so the lists aren't empty and so the reminder workflow has an overdue loan to find.

## Step 9: Try the whole flow

You need two accounts: an owner and a borrower. Your admin account is the owner. For the borrower, use a Clerk test
email, so you don't need a second inbox.

### 9.1 Create the borrower account

1. Open a private or incognito window at <http://localhost:3000>. This keeps the two sign-ins apart.
2. Sign up with an email that contains `+clerk_test`, for example `neighbor+clerk_test@example.com`.
3. When Clerk asks for the code, enter `424242`. Clerk doesn't send email to test addresses.

### 9.2 List a tool (owner window)

1. **Dashboard → My listings → List a tool**.
2. Fill in the name, category and condition, then click **List tool**.

### 9.3 Request it (borrower window)

1. **Dashboard → All tools**. Find your tool and click **Request**.
2. Pick start and end dates, then click **Send request**.
3. In Mailpit, an email arrives for the owner: _"... wants to borrow your ..."_.

### 9.4 Approve it (owner window)

1. **Dashboard → Incoming**. The request is there. Click **Approve**.
2. In Mailpit, an email arrives for the borrower: _"Approved: ..."_.
3. Under the loan, a small line reads **Notification sent just now**. Hover over it for the details. If n8n is down,
   it says **failed** instead, after Convex retries.

### 9.5 Return it (owner window)

1. On the same loan, click **Mark returned**.
2. In Mailpit, the borrower gets _"Returned: ..."_.

### 9.6 Admin features (owner window)

1. Open the **Admin** tab. It lists all loans, all listings and all neighbors.
2. Next to a neighbor, click **Mark trusted**. Their tools now show a **Trusted Lender** badge.

### 9.7 Overdue reminder (n8n)

The reminder runs by itself every day at 09:00 UTC. To run it now:

1. In n8n, open **LendLoop: overdue reminders**.
2. Click **Execute workflow** at the bottom of the canvas.
3. In Mailpit, Lee gets _"Reminder: please return the Extension ladder"_. This needs the demo data from Step 8.
4. Each overdue loan gets one reminder per UTC day. If you run it again on the same day, it finds nothing to send.
   That is correct.

To see every run, open **Executions** in n8n.

## Stopping and starting again

| To                      | Do this                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Stop the app and Convex | Press Ctrl+C in Terminal 1.                                 |
| Stop n8n and Mailpit    | `just n8n-down`                                             |
| Start everything again  | `just dev` in Terminal 1, then `just n8n-up` in Terminal 2. |

Your data stays between runs. Convex keeps it in `.convex/`, and n8n keeps it in a Docker volume.

`just n8n-up` imports the workflows from `n8n/workflows/` again, which replaces any changes you made in the n8n
editor. To keep your edits, run `just n8n-export` first. It saves them into `n8n/workflows/`.

## Troubleshooting

| What you see                                                        | Cause and fix                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `A local backend is still running on port 3210`                     | An earlier `just dev` is still running. Close it with Ctrl+C. If it is gone but the port is still busy, run `lsof -nP -iTCP:3210 -sTCP:LISTEN` and stop that process with `kill <PID>`.                                                         |
| Browser console: `404` on `/tokens/convex`                          | The Convex integration in Clerk is off. Do Step 3.3.                                                                                                                                                                                            |
| `Environment variable CLERK_JWT_ISSUER_DOMAIN ... was not set`      | Do Step 5.                                                                                                                                                                                                                                      |
| Signed in, but the dashboard stays empty or says you are signed out | `CLERK_JWT_ISSUER_DOMAIN` doesn't match your Clerk app. Compare it with the Frontend API URL in Step 3.3, then set it again.                                                                                                                    |
| No **Admin** tab                                                    | Your email isn't in `ADMIN_EMAILS`. See Step 6.                                                                                                                                                                                                 |
| `just n8n-up` waits forever                                         | Docker Desktop isn't running, or n8n failed to start. Check with `docker compose logs n8n`.                                                                                                                                                     |
| No email in Mailpit after an approval                               | Look at the line under the loan. If it says **failed**, hover over it for the reason. Then check n8n **Executions**, and run `bunx convex env list` to confirm `N8N_WEBHOOK_URL` is set. Running `just n8n-up` again fixes most setup problems. |
| `port is already allocated` for 5678 or 8025                        | Something else is using that port. Stop it, or stop old containers with `docker ps` and `docker stop <name>`.                                                                                                                                   |
