import { createClient } from 'npm:@supabase/supabase-js@2.100.1'
import nodemailer from 'npm:nodemailer@6.9.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? 'https://568-platform.vercel.app'
const outlookEmail = Deno.env.get('OUTLOOK_EMAIL') ?? ''
const outlookPassword = Deno.env.get('OUTLOOK_PASSWORD') ?? ''

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: { user: outlookEmail, pass: outlookPassword },
})

async function sendInviteEmail(to: string, name: string, link: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="margin:0;font-size:18px;color:#f1f5f9;font-weight:700;">Turni 568</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;">Sei stato invitato ad accedere all'app <strong>Turni 568</strong>. Clicca il bottone qui sotto per impostare la tua password e accedere.</p>
      <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">Imposta password</a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Il link scade tra 24 ore. Se non hai richiesto questo invito, ignora questa email.</p>
    </div>
  </div>
</body></html>`

  await transporter.sendMail({
    from: `Turni 568 <${outlookEmail}>`,
    to,
    subject: 'Sei stato invitato su Turni 568',
    html,
  })
}

// Admin client — service role, bypassa RLS
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // Valida JWT del caller e verifica che sia admin
    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

    if (!token) {
      return Response.json({ error: 'Missing bearer token' }, { status: 401, headers: corsHeaders })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData.user) {
      return Response.json({ error: 'Token non valido' }, { status: 401, headers: corsHeaders })
    }

    // Verifica ruolo admin
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (callerProfile?.role !== 'admin') {
      return Response.json({ error: 'Accesso non autorizzato' }, { status: 403, headers: corsHeaders })
    }

    const { profileId } = await request.json()
    if (!profileId) {
      return Response.json({ error: 'Missing profileId' }, { status: 400, headers: corsHeaders })
    }

    // Recupera il profilo del dipendente da invitare
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', profileId)
      .maybeSingle()

    if (profileError || !profile) {
      return Response.json({ error: 'Profilo non trovato' }, { status: 404, headers: corsHeaders })
    }

    // Genera il link di invito (crea l'utente auth se non esiste)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: profile.email,
      options: {
        redirectTo: `${appUrl}/set-password`,
        data: { full_name: profile.full_name, profile_id: profile.id },
      },
    })

    if (linkError) {
      // Se l'utente esiste già, genera un recovery link
      if (
        linkError.message?.includes('already been registered') ||
        linkError.message?.includes('already registered') ||
        linkError.message?.includes('already exists')
      ) {
        const { data: recoveryData, error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: profile.email,
          options: { redirectTo: `${appUrl}/set-password` },
        })

        if (recoveryError) {
          return Response.json({ error: `Impossibile generare link: ${recoveryError.message}` }, { status: 500, headers: corsHeaders })
        }

        const recoveryLink = recoveryData?.properties?.action_link
        if (!recoveryLink) {
          return Response.json({ error: 'Link recovery non valido' }, { status: 500, headers: corsHeaders })
        }

        await sendInviteEmail(profile.email, profile.full_name, recoveryLink)
        await supabaseAdmin.from('employees').update({ invited: true }).eq('profile_id', profileId)
        return Response.json({ ok: true, action: 'recovery_link_sent', email: profile.email }, { headers: corsHeaders })
      }

      return Response.json({ error: `Errore generazione link: ${linkError.message}` }, { status: 500, headers: corsHeaders })
    }

    const inviteLink = linkData?.properties?.action_link
    if (!inviteLink) {
      return Response.json({ error: 'Link invito non valido' }, { status: 500, headers: corsHeaders })
    }

    // Invia email via Outlook SMTP
    await sendInviteEmail(profile.email, profile.full_name, inviteLink)

    // Collega auth_user_id al profilo
    if (linkData?.user?.id) {
      await supabaseAdmin
        .from('profiles')
        .update({ auth_user_id: linkData.user.id })
        .eq('id', profileId)
    }

    // Segna come invitato nel DB
    await supabaseAdmin.from('employees').update({ invited: true }).eq('profile_id', profileId)

    return Response.json({ ok: true, action: 'invite_sent', email: profile.email }, { headers: corsHeaders })
  } catch (err) {
    console.error('send-invite error:', err)
    return Response.json({ error: err.message ?? 'Internal error' }, { status: 500, headers: corsHeaders })
  }
})
