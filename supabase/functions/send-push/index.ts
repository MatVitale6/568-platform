import { createClient } from 'npm:@supabase/supabase-js@2.100.1'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return Response.json({ error: 'Missing bearer token' }, {
        status: 401,
        headers: corsHeaders,
      })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return Response.json({ error: 'Invalid bearer token' }, {
        status: 401,
        headers: corsHeaders,
      })
    }

    const body = await request.json()
    const { profileIds, title, body: messageBody, url } = body

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return Response.json({ error: 'profileIds is required' }, {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('profile_id', profileIds)
      .eq('active', true)

    if (error) {
      return Response.json({ error: error.message }, {
        status: 500,
        headers: corsHeaders,
      })
    }

    const payload = JSON.stringify({ title, body: messageBody, url })
    let sentCount = 0
    let failedCount = 0
    const failures = []

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        )
        sentCount += 1
      } catch (pushError) {
        const statusCode = pushError.statusCode ?? 500
        failedCount += 1
        failures.push({
          subscriptionId: subscription.id,
          statusCode,
          message: pushError.body ?? pushError.message ?? 'Unknown push error',
        })

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ active: false })
            .eq('id', subscription.id)
        }
      }
    }

    return Response.json({
      ok: true,
      subscriptionCount: subscriptions?.length ?? 0,
      sentCount,
      failedCount,
      failures,
    }, {
      headers: corsHeaders,
    })
  } catch (error) {
    return Response.json({ error: error.message ?? 'Unexpected error' }, {
      status: 500,
      headers: corsHeaders,
    })
  }
})