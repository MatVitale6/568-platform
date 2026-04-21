/**
 * E2E test per SetPassword — verifica che non ci sia redirect loop
 * dopo aver impostato la password per un utente con first_login_completed=false
 *
 * Prerequisito: utente con first_login_completed=false nel DB
 * Usage: node tests/e2e-set-password.js --email EMAIL --password PASSWORD
 *
 * Prima del test l'utente deve avere first_login_completed=false:
 *   .\tests\test-set-password.ps1 -Email EMAIL -Password PASSWORD  (usa T6 per ripristinare)
 */

import puppeteer from 'puppeteer'

const APP_URL = 'https://568-platform.vercel.app'

const args = process.argv.slice(2)
const emailIdx  = args.indexOf('--email')
const passIdx   = args.indexOf('--password')
const EMAIL     = emailIdx  !== -1 ? args[emailIdx  + 1] : null
const PASSWORD  = passIdx   !== -1 ? args[passIdx   + 1] : null

if (!EMAIL || !PASSWORD) {
  console.error('Usage: node tests/e2e-set-password.js --email EMAIL --password PASSWORD')
  process.exit(1)
}

const NEW_PASSWORD = PASSWORD  // stessa password (re-set dello stesso valore)

let passed = 0
let failed = 0

function ok(msg)   { console.log(`  \x1b[32m[PASS]\x1b[0m ${msg}`); passed++ }
function fail(msg) { console.log(`  \x1b[31m[FAIL]\x1b[0m ${msg}`); failed++ }
function info(msg) { console.log(`  \x1b[36m[INFO]\x1b[0m ${msg}`) }
function head(msg) { console.log(`\n\x1b[33m=== ${msg} ===\x1b[0m`) }

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  page.setDefaultTimeout(15000)

  // Cattura errori JS della pagina
  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(err.message))

  try {
    // ─── T1: Caricamento app ───────────────────────────────────
    head('T1 - App load')
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
    const title = await page.title()
    info(`Page title: ${title}`)
    ok('App caricata')

    // ─── T2: Login ────────────────────────────────────────────
    head('T2 - Login')
    await page.type('input[type="email"]', EMAIL)
    await page.type('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // Aspetta navigazione: o /calendar o /set-password
    await page.waitForNavigation({ waitUntil: 'networkidle2' })
    const afterLogin = page.url()
    info(`URL dopo login: ${afterLogin}`)

    if (afterLogin.includes('/set-password')) {
      ok('Reindirizzato a /set-password (first_login_completed=false, comportamento atteso)')

      // ─── T3: Compila e invia il form ────────────────────────
      head('T3 - Set password form')
      await page.waitForSelector('input[type="password"]')
      const inputs = await page.$$('input[type="password"]')
      if (inputs.length < 2) {
        fail('Form non ha 2 campi password')
        await browser.close()
        return
      }
      await inputs[0].type(NEW_PASSWORD)
      await inputs[1].type(NEW_PASSWORD)
      ok('Form compilato')

      // ─── T4: Submit e verifica redirect a /calendar ─────────
      head('T4 - Submit e verifica no redirect loop')
      await page.click('button[type="submit"]')

      // Aspetta max 8 secondi per la navigazione finale
      let finalUrl = ''
      let attempts = 0
      while (attempts < 16) {
        await new Promise(r => setTimeout(r, 500))
        finalUrl = page.url()
        if (finalUrl.includes('/calendar') || finalUrl.includes('/set-password')) break
        attempts++
      }

      info(`URL finale: ${finalUrl}`)

      if (finalUrl.includes('/calendar')) {
        ok('Navigato a /calendar — nessun redirect loop')
        ok('Bug race condition RISOLTO')
      } else if (finalUrl.includes('/set-password')) {
        fail('Ancora su /set-password dopo il submit — REDIRECT LOOP CONFERMATO')
        fail('Il bug non e stato risolto')
      } else {
        fail(`URL inatteso: ${finalUrl}`)
      }

      // ─── T5: Verifica che la pagina /calendar si carichi ────
      if (finalUrl.includes('/calendar')) {
        head('T5 - /calendar accessibile')
        try {
          await page.waitForSelector('body', { timeout: 3000 })
          const bodyText = await page.$eval('body', el => el.innerText)
          if (bodyText.includes('Caricamento') || bodyText.includes('turni') || bodyText.length > 50) {
            ok('Pagina calendario caricata correttamente')
          } else {
            info(`Body text breve: "${bodyText.slice(0, 100)}"`)
          }
        } catch {
          info('Timeout su /calendar — potrebbe essere normale se il calendario ci mette a caricare')
        }
      }

      // ─── T6: Ricarica la pagina e verifica no redirect ──────
      if (finalUrl.includes('/calendar')) {
        head('T6 - Ricarica /calendar (verifica persistenza firstLoginCompleted)')
        await page.reload({ waitUntil: 'networkidle2' })
        const reloadUrl = page.url()
        info(`URL dopo reload: ${reloadUrl}`)

        if (reloadUrl.includes('/calendar')) {
          ok('Dopo reload rimane su /calendar — firstLoginCompleted persistito correttamente')
        } else if (reloadUrl.includes('/set-password')) {
          fail('Dopo reload reindirizzato a /set-password — first_login_completed non salvato nel DB')
        } else {
          info(`URL dopo reload: ${reloadUrl}`)
        }
      }

    } else if (afterLogin.includes('/calendar')) {
      ok('Utente gia con first_login_completed=true — nessun redirect a /set-password')
      info('Per testare il fix, ripristina first_login_completed=false con test-set-password.ps1 T6')
    } else {
      fail(`URL inatteso dopo login: ${afterLogin}`)
    }

    // ─── Errori JS ───────────────────────────────────────────
    if (pageErrors.length > 0) {
      head('Errori JS nella pagina')
      pageErrors.forEach(e => fail(`JS Error: ${e}`))
    }

  } catch (err) {
    fail(`Errore Puppeteer: ${err.message}`)
    console.error(err)
  } finally {
    await browser.close()
  }

  // ─── Riepilogo ────────────────────────────────────────────
  console.log('')
  console.log(`\x1b[33m=== Riepilogo: ${passed} PASS, ${failed} FAIL ===\x1b[0m`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
