# Installation Reporting Portal

Staff portal for Victorian Energy Upgrades (VEU) installers. It covers Activity 6 (high-efficiency air-conditioners): capturing the customer, premises, building-age evidence, prior installations, decommissioned and new products, tradespeople, field photos and signatures. It then moves each job through review to VEEC submission and payment.

## Live demo

**https://buckmickshot.github.io/installation-reporting-portal/**  (deployed automatically from `main` by GitHub Actions)

Demo accounts (fictional, password `VeuDemo#2026`):

| Email | Role | Company |
| --- | --- | --- |
| `olivia.chen@example.com` | Company admin (reviewer) | Northside Climate Solutions |
| `jack.taylor@example.com` | Staff / installer | Northside Climate Solutions |
| `priya.nair@example.com` | Company admin | Bayside Air Co. (separate company – shows data isolation) |

The showcase job **Alex Morgan – 17 Banksia Street** is complete and waiting for review: open it, *Export assignment form*,
*Mark as submitted* (the PDF downloads automatically), then *↩ Revert last status change* to run the demo again.
Global admins also get **↺ Reset demo data** on the dashboard.

## Security

| Control | How |
| --- | --- |
| Row-level security | Every `snapshot` table; per-company isolation and role checks run inside Postgres |
| Encryption at rest | Customer phone/email stored as AES-256 (pgcrypto) ciphertext; key held in Supabase Vault |
| Two-factor auth | TOTP authenticator apps (Security page); once enrolled the **database** returns no data until the session is AAL2 |
| Email verification | Accounts must confirm email; passwordless one-time email codes on the sign-in page |
| Passwords | bcrypt hashes (Supabase Auth) |
| Audit trail | Status changes, allocations, evidence and notes recorded automatically |
| Transport | HTTPS/TLS everywhere |

## Features

| Area | What it does |
| --- | --- |
| **Jobs dashboard** | Pipeline counts (draft → info requested → ready for review → submitted → approved → paid), search by job ref / customer / address / phone, filters by status, assignee and company, CSV export |
| **Job wizard** | Customer · Decommission · Benefit & Install · Workers · Review · Post-install · Declaration. Every tab is saved and comes back when a job is resumed |
| **Job overview** | Status actions, live **compliance checklist**, installer allocation, photos & signatures, notes and full audit timeline |
| **Field mode** (`/jobs/:id/field`) | Mobile page for installers: shot list with one-tap camera capture (timestamp + GPS stored), serial numbers, install date, customer & installer e-signatures |
| **Review workflow** | Staff send jobs for review; admins request information (RFI), submit, approve and mark paid. Submitted jobs are locked for staff |
| **Reuse** | Premises, building documents, prior-install totals and customers are reused across jobs at the same address |
| **Permissions** | Staff / company admin / global admin, enforced in Postgres row-level security (not just the UI) |

## Tech

React 19 (Create React App) · Supabase (Postgres, Auth, Storage, PostgREST) · schema `snapshot`.

## Run it locally

You need Node 18+ and a local Supabase. Pick one of these:

**A. Supabase CLI (needs Docker)**

```bash
npx supabase start          # prints the API URL + anon key
npx supabase db reset       # applies supabase/migrations + supabase/seed.sql
```

Then add `snapshot` to `[api].schemas` in `supabase/config.toml` and create users in Studio (http://localhost:54323).

**B. No Docker (Linux, Postgres 15+ installed)**

```bash
npm run db:start            # downloads PostgREST + Supabase Auth, creates DB, migrates, seeds demo users
npm run db:test             # checks the database contract and permission rules
npm run db:stop
```

Demo logins (password `Password123!`):

- `admin@demo.local`: global admin, sees every company
- `manager@acme.local`: company admin (reviewer)
- `installer@acme.local`: staff

Then:

```bash
cp .env.example .env        # fill in URL + anon key printed above
npm install
npm start
```

Emails (invites, password resets) from the no-Docker stack are captured at http://localhost:54321/mail.

## Deploy to a new Supabase project

1. Create a project and run the two files in `supabase/migrations/` in order: `npx supabase db push`, or paste them into the SQL editor.
2. **Settings → API → Exposed schemas**: add `snapshot`.
3. **Authentication → URL configuration**: set the Site URL to your portal and add `https://<your-domain>/auth/callback` as a redirect URL.
4. Create the first global admin. Add a user in **Authentication → Users**, then run in the SQL editor:
   ```sql
   with c as (insert into snapshot.companies default values returning company_id)
   insert into snapshot.company_versions (company_id, name, address) select company_id, 'Your company', 'Address' from c;
   insert into snapshot.profiles (user_id, company_id, name, email, is_admin, is_global_admin)
   select u.id, (select company_id from snapshot.companies limit 1), 'Your name', u.email, true, true
   from auth.users u where u.email = 'you@example.com';
   ```
5. Load the real ESC Activity 6 product register into `snapshot.activity_6_registry`. `supabase/seed.sql` only has fictional demo rows.
6. Build the front end with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` set (plus `REACT_APP_GEOSCAPE_API_KEY` for verified address lookup), and host `build/` with an SPA fallback to `index.html`.

> **Free-plan note:** Supabase pauses free projects after a week without activity. Paused projects can be restored from the dashboard, and the migrations here can rebuild the schema in a fresh project at any time.

## Project structure

```text
supabase/migrations/    Database schema, functions, RLS (source of truth for the backend)
supabase/seed.sql       Demo registry rows
dev/local-supabase/     Docker-free local stack, demo users, API smoke test
src/components/jobs/    Job overview, field mode, evidence & signature capture
src/components/homeScreen/  Dashboard, settings, job loader
src/components/jobCreation/ Job wizard (Activity 6 screens)
src/relationship/       Supabase client, save logic, storage helpers
src/utils/              Fields, compliance checklist, status rules, CSV
```

## Scripts

`npm start` · `npm run build` · `npm run test:ci` (unit tests) · `npm run lint` · `npm run db:start|db:stop|db:test`

## Known gaps / next steps

- Only Activity 6 is built. Activities 1, 3, 12+ are stubbed in `InstallationTypesData.js`.
- "Submitted" is recorded manually. There is no direct API lodgement to the VEU registry, so use the CSV export or registry bulk upload.
- Creating users from the portal uses `auth.signUp`. To stop strangers signing themselves up, disable public sign-ups and move user creation to an Edge Function with the service-role key. Profiles are only created by admins, so a self-signed-up account can't log in.
