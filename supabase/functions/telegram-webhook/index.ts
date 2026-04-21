import { createClient } from 'npm:@supabase/supabase-js@2.100.1'

const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const appUrl = Deno.env.get('APP_URL') ?? 'https://568-platform.vercel.app'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  if (!botToken) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.warn('Telegram send failed:', e)
  }
}

Deno.serve(async (request) => {
  // Telegram only sends POST
  if (request.method !== 'POST') {
    return new Response('OK', { status: 200 })
  }

  // Verify the secret token we set when registering the webhook
  if (webhookSecret) {
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
    if (secretHeader !== webhookSecret) {
      console.warn('Invalid webhook secret received')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let update: Record<string, unknown>
  try {
    update = await request.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Handle regular messages only
  const message = update.message as {
    chat: { id: number }
    text?: string
    from?: { first_name?: string }
  } | undefined

  if (!message?.text) {
    return new Response('OK', { status: 200 })
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  if (text.startsWith('/start')) {
    const parts = text.split(' ')
    const rawToken = parts[1]

    if (!rawToken) {
      // No linking token — show instructions
      await sendMessage(
        chatId,
        `👋 <b>Ciao! Sono il bot di Turni 568.</b>\n\nPer collegare il tuo account apri l'app e tocca <b>"Collega Telegram"</b> nella sezione Richieste.\n\n👉 <a href="${appUrl}">Apri l'app</a>`,
      )
      return new Response('OK', { status: 200 })
    }

    const token = rawToken.toUpperCase()

    // Look up the linking token
    const { data: linkToken, error: tokenError } = await supabase
      .from('telegram_link_tokens')
      .select('profile_id, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !linkToken) {
      await sendMessage(chatId, '❌ Codice non valido o già usato. Genera un nuovo codice dall\'app.')
      return new Response('OK', { status: 200 })
    }

    if (new Date(linkToken.expires_at) < new Date()) {
      await supabase.from('telegram_link_tokens').delete().eq('token', token)
      await sendMessage(chatId, '⏰ Il codice è scaduto (valido 10 minuti). Genera un nuovo codice dall\'app.')
      return new Response('OK', { status: 200 })
    }

    // Save telegram_chat_id to profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ telegram_chat_id: String(chatId), updated_at: new Date().toISOString() })
      .eq('id', linkToken.profile_id)

    if (updateError) {
      console.error('Error saving chat_id:', updateError)
      await sendMessage(chatId, '❌ Errore durante il collegamento. Riprova tra qualche secondo.')
      return new Response('OK', { status: 200 })
    }

    // Delete the used token
    await supabase.from('telegram_link_tokens').delete().eq('token', token)

    // Fetch name for personalised greeting
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', linkToken.profile_id)
      .maybeSingle()

    await sendMessage(
      chatId,
      `✅ <b>Account collegato!</b>\n\nCiao <b>${profile?.full_name ?? ''}</b>! Da ora riceverai qui le notifiche di Turni 568:\n• 🔄 Richieste cambio turno\n• ✅ Risposte alle tue richieste\n• 📅 Riepilogo turni settimanale`,
    )
  }

  return new Response('OK', { status: 200 })
})
