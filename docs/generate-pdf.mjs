import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const htmlPath = path.join(__dirname, 'guida-turni-568.html')
const pdfPath = path.join(__dirname, 'Turni-568-Guida.pdf')

console.log('⏳  Avvio browser headless...')

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Users\\bello\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ],
  timeout: 60000,
})

const page = await browser.newPage()

// Load the HTML file directly from disk
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })

// Wait for fonts/images to settle
await new Promise(r => setTimeout(r, 1500))

console.log('📄  Generazione PDF...')

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: {
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%; font-size:8pt; color:#94a3b8; display:flex; justify-content:space-between; padding: 0 50px; font-family: Segoe UI, Arial, sans-serif;">
      <span>Turni 568 · Birreria 568 Garbatella</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  `,
})

await browser.close()

console.log(`✅  PDF generato: ${pdfPath}`)
