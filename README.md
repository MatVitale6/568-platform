# 568 Platform

Web app per la gestione dei turni settimanali del locale 568.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | Tailwind CSS v4 + Shadcn/ui |
| Routing | React Router v7 |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Notifiche | Resend (email) + Telegram Bot |
| Deploy | Vercel |
| Test | Vitest + Testing Library |

## Funzionalità

### Operative
- Login con autenticazione Supabase e ruoli (admin / employee)
- Primo accesso con link di invito → imposta password → accesso automatico
- Gestione dipendenti: crea, modifica, elimina, invita via email o link diretto
- Badge stato dipendente: **Non invitato** / **Invitato** / **Attivo** (ha completato il primo accesso)
- Calendario turni settimanale con navigazione e copia settimana
- Creazione e modifica turni con drag-and-drop
- Gestione giorni di chiusura
- Richieste di cambio turno con badge pending
- Accettazione / rifiuto cambi turno
- Notifiche email (Resend) per ogni evento swap e digest settimanale
- Notifiche Telegram: collegamento account tramite bot, notifiche swap e digest settimanale
- Layout mobile-first / PWA-ready

### Non ancora implementato
- Web Push (infrastruttura presente, in attesa di dominio verificato per VAPID)
- Dominio email verificato su Resend (attualmente sandbox `onboarding@resend.dev`)

## Struttura del progetto

```text
frontend/
  src/
    __tests__/          # Test routing (Gruppo B)
    components/
      calendar/
      employees/
      modals/
      ui/
    context/
      __tests__/        # Test mapSupabaseUser (Gruppo A)
      AuthContext.tsx
      RequestsContext.tsx
    hooks/
    lib/
      __tests__/        # Test colorUtils (Gruppo A)
      colorUtils.ts     # Funzioni pure per colori avatar
      supabase.ts
    pages/
supabase/
  functions/
    send-email/         # Notifiche swap via email + Telegram
    send-invite/        # Invito dipendenti (email o link diretto)
    telegram-webhook/   # Webhook bot Telegram per collegamento account
    weekly-digest/      # Digest settimanale email + Telegram
  schema.sql
  bootstrap_admin.sql
  telegram.sql
  push_notifications.sql
tests/
  test-set-password.ps1   # Test API PowerShell (richiede $env:SUPABASE_ANON_KEY)
  e2e-set-password.js     # Test E2E Puppeteer
test-telegram.ps1         # Test integrazione Telegram (richiede $env:TELEGRAM_BOT_TOKEN)
```

## Setup locale

### Requisiti
- Node.js 18+
- npm 9+
- Progetto Supabase

### Installazione

```bash
git clone https://github.com/MatVitale6/568-platform.git
cd 568-platform/frontend
npm install
```

### Variabili d'ambiente

Crea `frontend/.env.local` partendo da `frontend/.env.example`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Avvio

```bash
cd frontend
npm run dev
```

### Test

```bash
cd frontend
npm test          # run once
npm run test:watch  # modalità watch
```

## Bootstrap Supabase

Esegui i seguenti SQL nell'ordine nel SQL Editor di Supabase:

1. **[supabase/schema.sql](supabase/schema.sql)** — schema principale
2. **[supabase/bootstrap_admin.sql](supabase/bootstrap_admin.sql)** — crea il primo utente admin (sostituire i placeholder)
3. **[supabase/swap_request_workflow.sql](supabase/swap_request_workflow.sql)** — workflow richieste cambio turno
4. **[supabase/push_notifications.sql](supabase/push_notifications.sql)** — tabelle Web Push
5. **[supabase/telegram.sql](supabase/telegram.sql)** — colonna `telegram_chat_id`, tabella token collegamento, RPC

Poi eseguire `NOTIFY pgrst, 'reload schema';` per aggiornare la cache PostgREST.

## Edge Functions

Deploy con:

```bash
npx supabase functions deploy <nome-funzione> --project-ref <ref> --use-api
```

Secrets da configurare in Supabase Dashboard → Functions → Secrets:

| Secret | Descrizione |
|---|---|
| `RESEND_API_KEY` | Chiave API Resend per email |
| `TELEGRAM_BOT_TOKEN` | Token del bot Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secret header per il webhook Telegram |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role (già disponibile di default) |
| `APP_URL` | URL dell'app (`https://568-platform.vercel.app`) |

## Deploy

```bash
npx vercel --prod
```


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
