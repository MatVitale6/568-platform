# Test Telegram Integration
# Usage: .\ test-telegram.ps1
# Imposta la variabile d'ambiente prima di eseguire:
#   $env:TELEGRAM_BOT_TOKEN = "<il tuo token>"

$BOT_TOKEN      = if ($env:TELEGRAM_BOT_TOKEN) { $env:TELEGRAM_BOT_TOKEN } else { throw "Imposta \$env:TELEGRAM_BOT_TOKEN prima di eseguire il test" }
$WEBHOOK_SECRET = "TurniBot568Webhook"
$WEBHOOK_URL    = "https://fnwuanftlhbqksldgafe.supabase.co/functions/v1/telegram-webhook"

function OK   { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green }
function FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function INFO { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Cyan }
function HEAD { param($msg) Write-Host "" ; Write-Host "=== $msg ===" -ForegroundColor Yellow }

# T1 - Webhook registrato
HEAD "T1 - Webhook registration"
$info = Invoke-RestMethod "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
if ($info.ok -and $info.result.url -eq $WEBHOOK_URL) {
    OK "Webhook punta a $($info.result.url)"
} else {
    FAIL "Webhook URL non corrisponde: '$($info.result.url)'"
}
if ($info.result.last_error_message) {
    FAIL "Ultimo errore webhook: $($info.result.last_error_message)"
} else {
    OK "Nessun errore webhook recente"
}
INFO "Pending updates: $($info.result.pending_update_count)"

# T2 - Webhook rifiuta POST senza secret
HEAD "T2 - Webhook rejects missing secret"
try {
    $body2 = '{"update_id":1,"message":{"message_id":1,"chat":{"id":999},"text":"/start TEST"}}'
    $resp2 = Invoke-WebRequest -Uri $WEBHOOK_URL -Method POST -ContentType "application/json" -Body $body2 -UseBasicParsing -ErrorAction Stop
    FAIL "Dovrebbe rispondere 401, ha risposto $($resp2.StatusCode)"
} catch {
    $code2 = $_.Exception.Response.StatusCode.value__
    if ($code2 -eq 401) { OK "Rifiuta richieste senza secret (401)" }
    else { FAIL "Errore inatteso (status $code2): $_" }
}

# T3 - Webhook accetta POST con secret valido (messaggio non-start)
HEAD "T3 - Webhook accepts valid secret"
try {
    $body3 = '{"update_id":2,"message":{"message_id":2,"chat":{"id":12345},"text":"ciao"}}'
    $headers3 = @{ "X-Telegram-Bot-Api-Secret-Token" = $WEBHOOK_SECRET }
    $resp3 = Invoke-WebRequest -Uri $WEBHOOK_URL -Method POST -ContentType "application/json" -Headers $headers3 -Body $body3 -UseBasicParsing -ErrorAction Stop
    if ($resp3.StatusCode -eq 200) {
        OK "Webhook risponde 200 a messaggio generico"
    } else {
        FAIL "Status inatteso: $($resp3.StatusCode)"
    }
} catch {
    FAIL "Errore: $_"
}

# T4 - Token invalido gestito gracefully
HEAD "T4 - Invalid token handled gracefully"
try {
    $body4 = '{"update_id":3,"message":{"message_id":3,"chat":{"id":12345},"text":"/start FAKTOKEN"}}'
    $headers4 = @{ "X-Telegram-Bot-Api-Secret-Token" = $WEBHOOK_SECRET }
    $resp4 = Invoke-WebRequest -Uri $WEBHOOK_URL -Method POST -ContentType "application/json" -Headers $headers4 -Body $body4 -UseBasicParsing -ErrorAction Stop
    if ($resp4.StatusCode -eq 200) {
        OK "Webhook risponde 200 (token invalido gestito gracefully)"
        INFO "L'utente Telegram 12345 ha ricevuto messaggio di errore dal bot"
    }
} catch {
    FAIL "Errore: $_"
}

# T5 - Bot raggiungibile
HEAD "T5 - Bot info"
$me = Invoke-RestMethod "https://api.telegram.org/bot$BOT_TOKEN/getMe"
if ($me.ok) {
    OK "Bot attivo: @$($me.result.username) - $($me.result.first_name)"
    if ($me.result.username -eq "Turni568Bot") { OK "Username corretto" }
    else { FAIL "Username inatteso: $($me.result.username)" }
} else {
    FAIL "Bot non raggiungibile"
}

# Riepilogo
HEAD "Riepilogo test automatici completati"
Write-Host ""
Write-Host "TEST MANUALI DA FARE NELL'APP:" -ForegroundColor Magenta
Write-Host "  M1. Linking: Requests -> 'Collega Telegram' -> apri link su telefono -> tappa Start -> verifica badge verde"
Write-Host "  M2. swap_new: crea richiesta come dipendente A -> dipendente B riceve msg Telegram"
Write-Host "  M3. swap_accepted: accetta richiesta -> richiedente riceve msg Telegram"
Write-Host "  M4. swap_rejected: rifiuta richiesta -> richiedente riceve msg Telegram"
Write-Host "  M5. Unlink: tocca 'Scollega Telegram' -> badge verde scompare -> no piu notifiche"
Write-Host "  M6. Digest: triggera il digest manuale (vedi istruzioni sotto)"
Write-Host ""
Write-Host "Per triggerare il digest manuale (come admin):" -ForegroundColor Yellow
Write-Host "  1. Vai su https://568-platform.vercel.app, apri DevTools -> Application -> Local Storage"
Write-Host "  2. Cerca la chiave 'supabase' -> espandi -> copia il valore 'access_token'"
Write-Host "  3. Esegui in PowerShell:"
Write-Host '  $h = @{ Authorization = "Bearer INCOLLA_JWT_QUI" }'
Write-Host '  Invoke-RestMethod "https://fnwuanftlhbqksldgafe.supabase.co/functions/v1/weekly-digest" -Method POST -Headers $h'

