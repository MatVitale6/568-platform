import { createClient } from 'npm:@supabase/supabase-js@2.100.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? 'https://568-platform.vercel.app'
const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'Turni 568 <noreply@568turni.it>'

// Day of week that triggers the digest (0=Sunday … 1=Monday … 6=Saturday)
// Can be overridden via DIGEST_DAY env var
const DIGEST_DAY = parseInt(Deno.env.get('DIGEST_DAY') ?? '1', 10)

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ────────────────────────────────────────────────
//  Date helpers
// ────────────────────────────────────────────────
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatItalian(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// ────────────────────────────────────────────────
//  HTML template — weekly digest
// ────────────────────────────────────────────────
function digestTemplate(weekLabel: string, rows: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; }
  .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .header { background:#0f172a; padding:24px 32px; }
  .header h1 { margin:0; font-size:18px; color:#f1f5f9; font-weight:700; }
  .header p  { margin:4px 0 0; font-size:13px; color:#94a3b8; }
  .body { padding:24px 32px; }
  .week-title { font-size:15px; font-weight:700; color:#0f172a; margin:0 0 20px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#f8fafc; color:#64748b; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; padding:8px 12px; text-align:left; border-bottom:1px solid #e2e8f0; }
  td { padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:top; }
  .closed { color:#94a3b8; font-style:italic; }
  .badge { display:inline-block; padding:2px 8px; border-radius:50px; font-size:11px; font-weight:600; margin:1px; }
  .cta { display:inline-block; margin-top:20px; background:#6366f1; color:#fff !important; text-decoration:none; padding:11px 22px; border-radius:8px; font-size:14px; font-weight:600; }
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 32px; font-size:12px; color:#94a3b8; text-align:center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Turni 568</h1>
    <p>Riepilogo settimanale</p>
  </div>
  <div class="body">
    <p class="week-title">📅 Turni della settimana — ${weekLabel}</p>
    <table>
      <thead><tr><th>Giorno</th><th>Dipendenti</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <a href="${appUrl}/calendar" class="cta">Apri calendario →</a>
  </div>
  <div class="footer">Turni 568 · Birreria 568 Garbatella · <a href="${appUrl}" style="color:#6366f1">Apri app</a></div>
</div>
</body>
</html>`
}

// ────────────────────────────────────────────────
//  Build and send the digest
// ────────────────────────────────────────────────
async function sendDigest() {
  const monday = getMondayOf(new Date())
  const sunday = addDays(monday, 6)
  const from = formatDate(monday)
  const to = formatDate(sunday)

  const weekLabel = `${monday.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} – ${sunday.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // Load shifts for the week with assigned employees
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select(`
      id,
      work_date,
      is_closed,
      shift_assignments (
        profiles:employee_id (id, full_name, color)
      )
    `)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: true })

  if (shiftsError) throw new Error(`Errore shifts: ${shiftsError.message}`)

  // Build all 7 days (even days without a shift row)
  const shiftsByDate: Record<string, typeof shifts[0] | null> = {}
  for (let i = 0; i < 7; i++) {
    shiftsByDate[formatDate(addDays(monday, i))] = null
  }
  for (const shift of shifts ?? []) {
    shiftsByDate[shift.work_date] = shift
  }

  let rows = ''
  for (const [dateStr, shift] of Object.entries(shiftsByDate)) {
    const dayLabel = formatItalian(dateStr)
    if (!shift || shift.is_closed) {
      rows += `<tr><td>${dayLabel}</td><td class="closed">Chiuso</td></tr>`
    } else {
      const employees = shift.shift_assignments
        ?.map((a: { profiles: { full_name: string; color: string } }) => {
          const color = a.profiles?.color ?? '#6366f1'
          const name = a.profiles?.full_name ?? '?'
          return `<span class="badge" style="background:${color}22; color:${color};">${name}</span>`
        })
        .join(' ') ?? '—'

      rows += `<tr><td>${dayLabel}</td><td>${employees}</td></tr>`
    }
  }

  // Fetch all active employee emails
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('role', 'employee')

  if (profilesError) throw new Error(`Errore profiles: ${profilesError.message}`)

  const emails = (profiles ?? []).map((p) => p.email).filter(Boolean)

  if (emails.length === 0) {
    console.log('Nessun dipendente trovato, digest non inviato')
    return
  }

  const html = digestTemplate(weekLabel, rows)

  // Send to each recipient individually (Resend free plan: no bulk to distinct to)
  let sent = 0
  for (const email of emails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `📅 Turni della settimana — ${weekLabel}`,
          html,
        }),
      })
      if (res.ok) sent++
      else console.warn(`Errore invio a ${email}: ${await res.text()}`)
    } catch (e) {
      console.warn(`Errore invio a ${email}:`, e)
    }
  }

  console.log(`Digest settimanale inviato a ${sent}/${emails.length} dipendenti`)
  return { sent, total: emails.length }
}

// ────────────────────────────────────────────────
//  Cron + HTTP handler
// ────────────────────────────────────────────────

// Cron: ogni lunedì alle 08:00 UTC (configurabile via DIGEST_DAY)
// Pattern: "0 8 * * 1" = lunedì alle 08:00
// Supabase Edge Functions supportano Deno.cron
Deno.cron('weekly-digest', '0 8 * * 1', async () => {
  const today = new Date().getDay()
  if (today !== DIGEST_DAY) {
    console.log(`Today (${today}) is not digest day (${DIGEST_DAY}), skipping`)
    return
  }
  if (!resendApiKey) {
    console.error('RESEND_API_KEY non configurata')
    return
  }
  try {
    await sendDigest()
  } catch (e) {
    console.error('Errore digest:', e)
  }
})

// HTTP handler: permette di triggerare il digest manualmente (es. per test)
Deno.serve(async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  if (!resendApiKey) {
    return Response.json({ error: 'RESEND_API_KEY non configurata' }, { status: 500, headers: corsHeaders })
  }

  // Only admins can trigger manually — validate JWT
  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return Response.json({ error: 'Missing token' }, { status: 401, headers: corsHeaders })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return Response.json({ error: 'Accesso non autorizzato' }, { status: 403, headers: corsHeaders })
  }

  try {
    const result = await sendDigest()
    return Response.json({ ok: true, ...result }, { headers: corsHeaders })
  } catch (e) {
    console.error('weekly-digest manual trigger error:', e)
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders })
  }
})
