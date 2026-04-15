import { createClient } from 'npm:@supabase/supabase-js@2.100.1'
import nodemailer from 'npm:nodemailer@6.9.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const outlookEmail = Deno.env.get('OUTLOOK_EMAIL') ?? ''
const outlookPassword = Deno.env.get('OUTLOOK_PASSWORD') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? 'https://568-platform.vercel.app'

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ────────────────────────────────────────────────
//  Init Outlook SMTP transporter
// ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: outlookEmail,
    pass: outlookPassword,
  },
})

// ────────────────────────────────────────────────
//  Helper: send one email via Outlook SMTP
// ────────────────────────────────────────────────
async function sendViaOutlook(to: string[], subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: outlookEmail,
      to: to.join(', '),
      subject,
      html,
    })
  } catch (error) {
    throw new Error(`Outlook SMTP error: ${error.message}`)
  }
}

// ────────────────────────────────────────────────
//  HTML templates
// ────────────────────────────────────────────────
function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .header { background:#0f172a; padding:24px 32px; }
  .header h1 { margin:0; font-size:18px; color:#f1f5f9; font-weight:700; letter-spacing:-0.02em; }
  .header p { margin:4px 0 0; font-size:13px; color:#94a3b8; }
  .body { padding:28px 32px; }
  .body p { font-size:14px; line-height:1.7; margin:0 0 16px; color:#334155; }
  .cta { display:inline-block; margin-top:8px; background:#6366f1; color:#fff !important; text-decoration:none; padding:12px 24px; border-radius:8px; font-size:14px; font-weight:600; }
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 32px; font-size:12px; color:#94a3b8; text-align:center; }
  .pill { display:inline-block; padding:3px 10px; border-radius:50px; font-size:12px; font-weight:600; }
  .pill-pending  { background:#fef3c7; color:#92400e; }
  .pill-accepted { background:#d1fae5; color:#065f46; }
  .pill-rejected { background:#fee2e2; color:#991b1b; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Turni 568</h1>
    <p>Birreria 568 Garbatella</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Turni 568 · Birreria 568 Garbatella · <a href="${appUrl}" style="color:#6366f1">Apri app</a></div>
</div>
</body>
</html>`
}

function swapNewTemplate(requesterName: string, targetName: string, workDate: string): string {
  const formatted = new Date(workDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return baseTemplate(`
    <p>Ciao <strong>${targetName}</strong>,</p>
    <p><strong>${requesterName}</strong> ti ha inviato una richiesta di cambio turno per il giorno:</p>
    <p style="font-size:16px; font-weight:700; color:#1e293b; margin:20px 0;">${formatted}</p>
    <p>Accedi all'app per accettare o rifiutare la richiesta.</p>
    <a href="${appUrl}/requests" class="cta">Vedi richiesta →</a>
  `)
}

function swapAcceptedTemplate(requesterName: string, targetName: string, workDate: string): string {
  const formatted = new Date(workDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return baseTemplate(`
    <p>Ciao <strong>${requesterName}</strong>,</p>
    <p><strong>${targetName}</strong> ha <span class="pill pill-accepted">accettato</span> la tua richiesta di cambio turno per il:</p>
    <p style="font-size:16px; font-weight:700; color:#1e293b; margin:20px 0;">${formatted}</p>
    <a href="${appUrl}/requests" class="cta">Vedi dettaglio →</a>
  `)
}

function swapRejectedTemplate(requesterName: string, targetName: string, workDate: string): string {
  const formatted = new Date(workDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return baseTemplate(`
    <p>Ciao <strong>${requesterName}</strong>,</p>
    <p><strong>${targetName}</strong> ha <span class="pill pill-rejected">rifiutato</span> la tua richiesta di cambio turno per il:</p>
    <p style="font-size:16px; font-weight:700; color:#1e293b; margin:20px 0;">${formatted}</p>
    <a href="${appUrl}/requests" class="cta">Vedi le tue richieste →</a>
  `)
}

// ────────────────────────────────────────────────
//  Handler: swap notification
// ────────────────────────────────────────────────
async function handleSwapNotification(body: {
  type: 'swap_new' | 'swap_accepted' | 'swap_rejected'
  requesterId: string
  targetId: string
  workDate: string
}) {
  const { type, requesterId, targetId, workDate } = body

  // Fetch names + emails from profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', [requesterId, targetId])

  if (error) throw new Error(`Errore caricamento profili: ${error.message}`)

  const requester = profiles?.find((p) => p.id === requesterId)
  const target = profiles?.find((p) => p.id === targetId)

  if (!requester || !target) throw new Error('Profili non trovati')

  if (type === 'swap_new') {
    await sendViaOutlook(
      [target.email],
      `${requester.full_name} ti ha chiesto un cambio turno`,
      swapNewTemplate(requester.full_name, target.full_name, workDate),
    )
  } else if (type === 'swap_accepted') {
    await sendViaOutlook(
      [requester.email],
      `${target.full_name} ha accettato il cambio turno`,
      swapAcceptedTemplate(requester.full_name, target.full_name, workDate),
    )
  } else if (type === 'swap_rejected') {
    await sendViaOutlook(
      [requester.email],
      `${target.full_name} ha rifiutato il cambio turno`,
      swapRejectedTemplate(requester.full_name, target.full_name, workDate),
    )
  }
}

// ────────────────────────────────────────────────
//  Main handler
// ────────────────────────────────────────────────
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  if (!outlookEmail || !outlookPassword) {
    return Response.json({ error: 'OUTLOOK_EMAIL e OUTLOOK_PASSWORD non configurate' }, { status: 500, headers: corsHeaders })
  }

  try {
    // JWT validation — require authenticated caller
    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

    if (!token) {
      return Response.json({ error: 'Missing bearer token' }, { status: 401, headers: corsHeaders })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) {
      return Response.json({ error: 'Invalid bearer token' }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json()

    if (!body.type) {
      return Response.json({ error: 'Missing type field' }, { status: 400, headers: corsHeaders })
    }

    if (['swap_new', 'swap_accepted', 'swap_rejected'].includes(body.type)) {
      await handleSwapNotification(body)
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    return Response.json({ error: `Unknown type: ${body.type}` }, { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error('send-email error:', err)
    return Response.json({ error: err.message ?? 'Internal error' }, { status: 500, headers: corsHeaders })
  }
})
