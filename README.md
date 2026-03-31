# 568 Platform

Private web app for weekly shift planning.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite |
| UI | Tailwind CSS v4 + Shadcn/ui |
| Routing | React Router |
| Backend | Supabase |
| Deploy | Vercel |

## Current status

### Working
- Login with role-based access
- Supabase auth bootstrap for the first admin
- Employee management backed by Supabase
- Weekly calendar backed by Supabase
- Create and update shifts
- Copy one week across a date range
- In-app swap requests page with pending badge
- Accept / reject swap requests inside the web app
- Web Push subscription UI and service worker base
- Closed days handling
- Swap request creation
- Mobile-first layout

### Still missing
- Real notifications (Web Push / Telegram)
- First-login password reset flow
- Final PWA packaging and Vercel deployment

## Project structure

```text
src/
  components/
    calendar/
    employees/
    modals/
    ui/
  context/
  hooks/
  lib/
  pages/
supabase/
  schema.sql
  bootstrap_admin.sql
```

## Local setup

### Requirements
- Node.js 18+
- npm 9+
- Supabase project

### Install

```bash
git clone https://github.com/MatVitale6/568-platform.git
cd 568-platform
npm install
```

### Environment

Create `.env.local` from `.env.example` and set:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Run

```bash
npm run dev
```

## Supabase bootstrap

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL Editor.

Then create the first auth user in Supabase Authentication and run [supabase/bootstrap_admin.sql](supabase/bootstrap_admin.sql) after replacing placeholder values.

To enable the full swap-request workflow, run [supabase/swap_request_workflow.sql](supabase/swap_request_workflow.sql) in the Supabase SQL Editor as well.

To enable Web Push subscriptions, run [supabase/push_notifications.sql](supabase/push_notifications.sql) in the Supabase SQL Editor.

If you already enabled push notifications before this fix, also run [supabase/push_notifications.sql](supabase/push_notifications.sql) again so the RPC helpers for subscription registration are created.

To send push notifications, deploy the Edge Function in [supabase/functions/send-push/index.ts](supabase/functions/send-push/index.ts) and configure these secrets in Supabase Functions:
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

## Data model

### Tables
- `profiles`: app profiles and roles
- `employees`: employee-only fields
- `shifts`: one row per day
- `shift_assignments`: employees assigned to a shift
- `swap_requests`: shift swap requests

### Auth model
- `profiles.id` is the internal app profile id
- `profiles.auth_user_id` links a profile to `auth.users.id`
- This allows creating employees before they have a real auth account

## Notes

- `.env.local` is ignored and must never be committed
- The app still has mock fallback paths, but the main employee and calendar flows now work with Supabase
- Web Push also requires `VITE_VAPID_PUBLIC_KEY` in `.env.local`
