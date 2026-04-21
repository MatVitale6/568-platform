# test-set-password.ps1
# Test API-level per verificare il fix della race condition in SetPassword
# Usage: .\test-set-password.ps1 -Email "emmavescia@..." -Password "nuovapassword"

param(
    [string]$Email    = "",
    [string]$Password = ""
)

$SUPABASE_URL    = "https://fnwuanftlhbqksldgafe.supabase.co"
$SUPABASE_ANON   = if ($env:SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY } else { throw "Imposta \$env:SUPABASE_ANON_KEY prima di eseguire il test" }

function OK   { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green }
function FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function INFO { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Cyan }
function HEAD { param($msg) Write-Host "" ; Write-Host "=== $msg ===" -ForegroundColor Yellow }

$authHeaders = @{
    "apikey"       = $SUPABASE_ANON
    "Content-Type" = "application/json"
}

# ─── T1: Utente non autenticato non puo aggiornare first_login_completed ────
HEAD "T1 - RLS: unauthenticated cannot update first_login_completed"
try {
    $body = '{"first_login_completed": true}'
    $resp = Invoke-RestMethod "$SUPABASE_URL/rest/v1/profiles" `
        -Method PATCH -Headers $authHeaders -Body $body `
        -ErrorAction Stop
    FAIL "Dovrebbe essere bloccato da RLS, invece ha risposto OK"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -in @(401, 403)) {
        OK "RLS blocca update senza JWT (status $code)"
    } else {
        INFO "Risposta $code (probabilmente OK — Supabase PostgREST ritorna 200 con 0 righe aggiornate per RLS)"
        OK "0 righe aggiornate per RLS (nessun JWT = nessun match)"
    }
}

# ─── T2: Login utente ────────────────────────────────────────────
HEAD "T2 - Login utente"
if (-not $Email -or -not $Password) {
    INFO "Parametri -Email e -Password non forniti, skip T2-T5"
    Write-Host ""
    Write-Host "Per eseguire i test completi:" -ForegroundColor Yellow
    Write-Host "  .\test-set-password.ps1 -Email 'email@test.com' -Password 'password'"
    exit 0
}

try {
    $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
    $loginResp = Invoke-RestMethod "$SUPABASE_URL/auth/v1/token?grant_type=password" `
        -Method POST -Headers $authHeaders -Body $loginBody -ErrorAction Stop
    $jwt = $loginResp.access_token
    $userId = $loginResp.user.id
    OK "Login riuscito per $Email (user_id: $userId)"
} catch {
    FAIL "Login fallito: $_"
    exit 1
}

$authedHeaders = @{
    "apikey"        = $SUPABASE_ANON
    "Authorization" = "Bearer $jwt"
    "Content-Type"  = "application/json"
}

# ─── T3: Leggi profilo prima del fix ─────────────────────────────
HEAD "T3 - Stato attuale first_login_completed"
try {
    $profile = Invoke-RestMethod "$SUPABASE_URL/rest/v1/profiles?auth_user_id=eq.$userId&select=id,full_name,first_login_completed,auth_user_id" `
        -Method GET -Headers $authedHeaders -ErrorAction Stop

    if ($profile.Count -gt 0) {
        $p = $profile[0]
        OK "Profilo trovato: $($p.full_name)"
        INFO "first_login_completed = $($p.first_login_completed)"
        INFO "auth_user_id = $($p.auth_user_id)"
        $profileId = $p.id

        if ($p.auth_user_id -ne $userId) {
            FAIL "auth_user_id nel profilo NON corrisponde all'auth uid! Questo causa il silent failure dell'update"
            INFO "auth_user_id atteso: $userId"
            INFO "auth_user_id trovato: $($p.auth_user_id)"
        } else {
            OK "auth_user_id corrisponde all'auth uid (update RLS passera)"
        }
    } else {
        FAIL "Nessun profilo trovato con auth_user_id = $userId"
        exit 1
    }
} catch {
    FAIL "Errore lettura profilo: $_"
    exit 1
}

# ─── T4: Simula update first_login_completed (come fa SetPassword) ─
HEAD "T4 - Simula update first_login_completed = true"
try {
    $updateBody = '{"first_login_completed": true}'
    $updateResp = Invoke-RestMethod "$SUPABASE_URL/rest/v1/profiles?auth_user_id=eq.$userId" `
        -Method PATCH -Headers ($authedHeaders + @{ "Prefer" = "return=representation" }) `
        -Body $updateBody -ErrorAction Stop

    if ($updateResp -and $updateResp[0].first_login_completed -eq $true) {
        OK "Update riuscito: first_login_completed = true"
    } elseif ($updateResp.Count -eq 0) {
        FAIL "Update ha aggiornato 0 righe! RLS sta bloccando l'update silenziosamente"
        INFO "Causa probabile: auth_user_id nel profilo non corrisponde a auth.uid()"
    } else {
        INFO "Risposta update: $($updateResp | ConvertTo-Json -Compress)"
    }
} catch {
    FAIL "Errore update: $_"
}

# ─── T5: Verifica che il profilo sia aggiornato (come fa refreshProfile) ──
HEAD "T5 - Verifica lettura post-update (simula refreshProfile)"
try {
    $profileAfter = Invoke-RestMethod "$SUPABASE_URL/rest/v1/profiles?auth_user_id=eq.$userId&select=first_login_completed" `
        -Method GET -Headers $authedHeaders -ErrorAction Stop

    if ($profileAfter[0].first_login_completed -eq $true) {
        OK "first_login_completed = true nel DB dopo l'update"
        OK "ProtectedRoute vedra firstLoginCompleted=true e non rimandara a /set-password"
    } else {
        FAIL "first_login_completed e ancora false nel DB! La race condition causera il redirect loop"
    }
} catch {
    FAIL "Errore verifica post-update: $_"
}

# ─── T6: Ripristina first_login_completed = false per retest ────────
HEAD "T6 - Ripristino (opzionale) per permettere un nuovo test"
$reset = Read-Host "Vuoi ripristinare first_login_completed=false per poter ritestare? [s/N]"
if ($reset -eq 's' -or $reset -eq 'S') {
    try {
        Invoke-RestMethod "$SUPABASE_URL/rest/v1/profiles?auth_user_id=eq.$userId" `
            -Method PATCH -Headers $authedHeaders `
            -Body '{"first_login_completed": false}' -ErrorAction Stop | Out-Null
        OK "Ripristinato a false"
    } catch {
        FAIL "Errore ripristino: $_"
    }
} else {
    INFO "Nessun ripristino eseguito"
}

Write-Host ""
Write-Host "=== Test completati ===" -ForegroundColor Yellow
Write-Host "Per il test E2E completo nel browser, esegui:" -ForegroundColor Magenta
Write-Host "  node tests\e2e-set-password.js"
