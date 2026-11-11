# Healthy Pots Platform

Prepaid healthy-meal subscription platform: **NestJS** API, **Next.js** web app, **PostgreSQL** (Prisma).
One login page serves customers, kitchen staff and admins; the user's role decides which portal they land in.

```
apps/
  api/   NestJS + Prisma (REST, JWT cookie auth, role guards)
  web/   Next.js 14 App Router (login + customer / operations / admin portals)
docker-compose.yml   local PostgreSQL
```

## One login, three portals

| Role | Signs in with | Lands in | Can open |
|---|---|---|---|
| `CUSTOMER` | mobile number + OTP | `/customer` | customer portal |
| `OPERATIONS` (kitchen & delivery) | email + password | `/operations` | operations portal |
| `OPS_ADMIN` | email + password | `/admin` | admin + operations |
| `SUPER_ADMIN` | email + password | `/admin` | everything, plus address correction and settings edits |

How it works: `POST /api/auth/otp/verify` or `/api/auth/login` sets an httpOnly `hp_token` JWT cookie and returns
`redirectTo`. The Next.js `middleware.ts` verifies the cookie and redirects each role to its own portal; the API
enforces the same rules again with `JwtAuthGuard` + `RolesGuard` (`@Roles(...)`), so hiding a page is never the only protection.
The browser only talks to the Next.js origin: `/backend/*` is proxied to the API (`next.config.mjs`), so the cookie is first-party.

## Quick start

Requirements: Node 20+, Docker (or any PostgreSQL 14+).

```bash
npm run setup                                # npm install + prisma generate
cp .env.example apps/api/.env                # then edit if needed
cp apps/web/.env.example apps/web/.env.local # JWT_SECRET must match the API
npm run db:up                                # PostgreSQL in Docker
npm run db:migrate -- --name init            # creates tables (commit the generated prisma/migrations folder)
npm run db:seed                              # plans, rate card, dishes, service area, staff + demo customers
npm run dev                                  # API on :4000 and web on :3000 together
```

On Windows use PowerShell and replace `cp` with `copy`.

## Commands

| Command | What it does |
|---|---|
| `npm run bootstrap` | one-step local setup: env files (new JWT_SECRET), PostgreSQL, migration, seed. Run after `npm install` |
| `npm run free-ports` | stop an old dev server still holding port 3000 or 4000 ("address already in use") |
| `npm run setup` | install dependencies and generate the Prisma client |
| `npm run dev` | run API and web together (`dev:api` / `dev:web` run one) |
| `npm run build` / `npm start` | production build / run both apps |
| `npm run typecheck` | TypeScript check for both apps |
| `npm run db:up` / `db:down` | start / stop PostgreSQL in Docker |
| `npm run db:migrate -- --name <name>` | create and apply a migration (dev) |
| `npm run db:deploy` | apply committed migrations (production) |
| `npm run db:seed` | load reference data (`SEED_DEMO=false` skips demo customers) |
| `npm run db:reset` | drop and rebuild the database (dev only) |
| `npm run db:studio` | browse data in Prisma Studio |
| `npm run cli -- <command>` | admin CLI, see below |

### Admin CLI

```bash
npm run cli -- create-staff --email asha@healthypots.in --name "Asha" --role OPS_ADMIN --password "Str0ng!Pass1"
npm run cli -- reset-password --email asha@healthypots.in --password "N3w!Password"
npm run cli -- set-active --email asha@healthypots.in --active false
npm run cli -- list-users
npm run cli -- stats
```

Roles: `SUPER_ADMIN`, `OPS_ADMIN`, `OPERATIONS`. Passwords need 10+ characters with upper case, lower case and a digit.

## Logging in (development)

- `OTP_MODE=off`: customers sign in with the mobile number only, no OTP. Anyone who knows a number can log in as that customer, so use it for development only; the API refuses to start in production with it.
- With `OTP_MODE=dev` (the default in `.env.example`), customers sign in with a mobile number and a 6-digit OTP. While `OTP_MODE=dev` the OTP is always `123456` and is printed in the API console. It is never shown in the browser.
- Seeded customers: `9000000001` (Aarav, peanut allergy), `9000000002` (Priya, fish), `9000000008` (Nisha, severe nut allergy).
- Staff: `riya@healthypots.in` (super admin), `ops.admin@healthypots.in`, `kitchen@healthypots.in`; password `ChangeMe@123` (override with `SEED_ADMIN_PASSWORD`). **Change these before going live.**
- Set `SEED_DEMO=false` before seeding to skip the demo customers.

## API documentation (Swagger)

With the API running, open http://localhost:4000/api/docs. Every endpoint is listed with its request fields and validation rules. To try protected endpoints, run `POST /api/auth/login` (staff) or `/api/auth/otp/verify` (customer) from that page; the login cookie is then used by every call. Docs are off in production unless `SWAGGER=true`.

## Validation and safety

- Every API request body is validated with `class-validator` DTOs (`*.dto.ts`): unknown fields are stripped, types are checked, Indian mobile numbers, 6-digit pincodes, ISO dates, ranges and lengths are enforced. Path ids must be UUIDs.
- Web forms show inline errors (`apps/web/src/lib/validate.ts`) and the API re-checks everything.
- Database errors map to clean 409 / 404 / 400 responses. Helmet headers, rate limiting (stricter on login and OTP) and a startup check of `DATABASE_URL` and `JWT_SECRET`.

## What is built

**Customer portal**: public goal browser, goal selection, 5-step subscription builder (about you, meals, allergies, delivery addresses, price), live price panel with discounts, GST and delivery, coupon, serviceability check, payment; dashboard with meal calendar, pause / resume / reschedule flows, 5-day delivery tracking with a status stepper, invoices and payments, allergies and diet, subscription history with renew.

**Operations portal**: overview, production sheet (grouped by meal, Veg / Non-Veg, allergen alerts), kitchen board (start / ready, bulk actions, ready creates the delivery job), delivery jobs (assign partner, advance status, report failure), exceptions, kitchen alerts.

**Admin portal**: overview, customers, subscriptions (+ manual subscription), allergies and dish swaps, schedule management, kitchen and delivery views, exception resolution, address correction (super admin), audit log, notifications, finance (payments, GST invoices, revenue by plan), integrations checklist, settings (service area, operating days, closures, rate card, pricing rules).

## Business rules enforced in the API

- Every meal is its own entitlement (`THP1001-B007`). A plan finishes when all meals are delivered, not after N calendar days.
- Customer changes for a service date close at **5:00 PM IST the previous day** (`common/dates.ts`). After that, meals are locked and the production sheet is final.
- Paused meals are excluded from the production sheet and move to the end of the plan when resumed.
- Addresses are fixed after payment; only a super admin can correct one, and the old / new value goes to the audit log.
- A failed delivery is not a completed meal until an admin resolves it (credit, redeliver or waive) with a reason.
- Allergens are matched against each dish; conflicts are flagged on the production sheet and meal assignment avoids declared allergens when a safe dish exists.
- Every override, schedule change and settings change is written to the audit log with actor, old value, new value and reason.
- Prices: `common/pricing.ts` (duration discount, multi-meal saving, coupon, delivery per drop by zone, GST). All rates and rules are editable in Admin > Settings.

## Integrations (not yet connected)

All vendors are stubbed behind small, documented endpoints until they confirm their APIs:

- **Shopify**: `POST /api/integrations/shopify/orders-paid` (HMAC verified with `SHOPIFY_WEBHOOK_SECRET`). Set `PAYMENT_MODE=shopify` to disable the in-app demo payment. Checkout must pass the backend payment code as a `payment_code` order attribute.
- **Delivery partner (Shadowfax)**: `POST /api/integrations/delivery/webhook` (header `x-webhook-secret` = `DELIVERY_WEBHOOK_SECRET`). The ops portal buttons call the same service code.
- **Petpooja**: not connected; confirm that it supports future-dated, meal-level orders first.
- **SMS / WhatsApp OTP and notifications**: implement `AuthService.sendOtp` and send from `EventsService`.

## Production checklist

- Set strong `JWT_SECRET` (same value in API and web), `OTP_MODE=prod` with an SMS provider, `PAYMENT_MODE=shopify`, `NODE_ENV=production` (secure cookies), HTTPS.
- Run `npm run prisma:deploy -w apps/api` for migrations; do not run the demo seed (`SEED_DEMO=false`).
- Change or delete the seeded staff accounts.
- Restrict `WEB_ORIGIN` to your web domain.
