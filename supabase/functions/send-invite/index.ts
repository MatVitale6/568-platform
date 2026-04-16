import { createClient } from 'npm:@supabase/supabase-js@2.100.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? 'https://568-platform.vercel.app'

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

    // Invia invito via Supabase Auth Admin API
    // Se l'utente esiste già, re-invia il link (utile per reinvii)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      profile.email,
      {
        redirectTo: `${appUrl}/set-password`,
        data: {
          full_name: profile.full_name,
          profile_id: profile.id,
        },
      },
    )

    if (inviteError) {
      // Se l'utente esiste già in auth.users, genera un magic link di reset password
      if (
        inviteError.message?.includes('already been registered') ||
        inviteError.message?.includes('already registered')
      ) {
        const { data: _linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: profile.email,
          options: { redirectTo: `${appUrl}/set-password` },
        })

        if (linkError) {
          return Response.json({ error: `Utente già registrato e impossibile generare nuovo link: ${linkError.message}` }, { status: 500, headers: corsHeaders })
        }

        await supabaseAdmin.from('employees').update({ invited: true }).eq('profile_id', profileId)
        return Response.json({ ok: true, action: 'recovery_link_sent', email: profile.email }, { headers: corsHeaders })
      }

      return Response.json({ error: `Errore invito: ${inviteError.message}` }, { status: 500, headers: corsHeaders })
    }

    // Collega auth_user_id al profilo (Supabase crea l'utente auth al momento dell'invito)
    if (inviteData?.user?.id) {
      await supabaseAdmin
        .from('profiles')
        .update({ auth_user_id: inviteData.user.id })
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
