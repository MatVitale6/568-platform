# 568 Platform  Pianificazione Turni

App web privata per la gestione e pianificazione dei turni settimanali di lavoro.

## Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 19 + Vite |
| Stile | Tailwind CSS v4 + Shadcn/ui |
| Routing | React Router v7 |
| Backend / DB | Supabase (in integrazione) |
| Deploy | Vercel (in configurazione) |

---

## Funzionalità implementate

### Autenticazione
- Login con email e password
- Due ruoli: **Amministratore** e **Dipendente**
- Protezione delle route in base al ruolo

### Calendario turni
- Visualizzazione settimanale europea (lunedì  domenica)
- Navigazione tra settimane
- Badge colorati con nome dipendente (indicatore `` per turno parziale)
- Giornate di chiusura: colorazione grigia automatica per domenica, lunedì e festività (24-26-31 dic, 1 gen, 1 mag)
- **Admin**: crea e modifica turni con selezione multipla dipendenti
- **Admin**: può impostare manualmente una giornata come "chiusura"
- **Dipendente**: può richiedere il cambio turno scegliendo un collega non già in turno quel giorno

### Gestione dipendenti *(solo Admin)*
- Elenco dipendenti con avatar colorato, contatti e stato invito
- Crea profilo: nome, cognome, codice fiscale, email, cellulare, data fine contratto
- Colore assegnato automaticamente dalla palette all'inserimento
- Modifica anagrafica esistente
- Elimina dipendente (con conferma)
- Invio invito via email (UI pronta, invio reale con Supabase)

---

## Funzionalità in roadmap

- [ ] **Supabase**: database reale, autenticazione, storage
- [ ] **Copia settimana**: duplica la pianificazione su un periodo definito
- [ ] **Notifiche**: Web Push in-app + Telegram Bot per richieste cambio turno
- [ ] **Link accetta/rifiuta**: il collega riceve un link e risponde direttamente
- [ ] **PWA**: installabile su mobile, icona home screen
- [ ] **Deploy Vercel**: CI/CD automatico da Git

---

## Struttura del progetto

```
src/
 pages/
    Login.jsx             # Schermata di accesso
    Calendar.jsx          # Pagina principale calendario
    Employees.jsx         # Gestione anagrafica (solo admin)
 components/
    Layout.jsx            # Shell app: header + bottom navigation
    calendar/
       DayRow.jsx        # Singola riga giorno con badge dipendenti
       EmployeeBadge.jsx # Badge colorato con nome e indicatore 
    modals/
       ShiftModal.jsx    # Modal admin: crea/modifica turno
       SwapModal.jsx     # Modal dipendente: richiedi cambio turno
    employees/
       EmployeeSheet.jsx      # Sheet crea/modifica dipendente
       DeleteConfirmDialog.jsx # Conferma eliminazione
    ui/                   # Componenti Shadcn/ui
 hooks/
    useCalendar.js        # Stato e logica calendario (mock  Supabase)
    useEmployees.js       # Stato e logica dipendenti (mock  Supabase)
 context/
    AuthContext.jsx       # Autenticazione globale (mock  Supabase Auth)
 lib/
     supabase.js           # Client Supabase
```

---

## Setup locale

### Prerequisiti
- Node.js >= 18
- npm >= 9
- Account Supabase

### Installazione

```bash
# 1. Clona il repository
git clone https://github.com/TUO-USERNAME/568-platform.git
cd 568-platform

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local inserendo le tue credenziali Supabase

# 4. Avvia il server di sviluppo
npm run dev
```

### Credenziali di test (mock, solo sviluppo)

| Ruolo | Email | Password |
|---|---|---|
| Amministratore | birreria568@gmail.com | admin |
| Dipendente | test@test.com | test |

> Queste credenziali mock verranno rimosse una volta integrato Supabase Auth.

---

## Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | URL del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chiave pubblica anonima Supabase |

Vedi `.env.example` per il template.

---

## Schema database (Supabase  in configurazione)

```
employees        anagrafica dipendenti
shifts           turni (giorno + stato chiusura)
shift_employees  relazione turno  dipendente (+ flag partial)
swap_requests    richieste cambio turno tra dipendenti
```
