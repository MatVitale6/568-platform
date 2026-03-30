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
- Closed days handling
- Swap request creation
- Mobile-first layout

### Still missing
- Copy week over a date range
- Real notifications (Web Push / Telegram)
- Accept / reject swap flow
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
