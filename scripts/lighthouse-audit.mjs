/**
 * Lighthouse-Audit der vier SPA-Komponenten gegen den laufenden
 * Docker-Stack. Ausgeführt mit Playwrights Chromium
 *   npm run audit:lighthouse
 * (Stack muss laufen: docker compose up -d --build)
 */
import lighthouse from 'lighthouse'
import { chromium as pwChromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3003'
const PAGES = ['/user_entry/', '/administration/', '/scheduling/', '/competencies/']
const DEBUG_PORT = 9222

// Lighthouse v12 connects to a running Chrome via puppeteer-core; launch
// Playwright's Chromium with the remote-debugging port ourselves.
const chrome = await pwChromium.launchPersistentContext('e2e/artifacts/lighthouse/profile', {
  headless: true,
  chromiumSandbox: false,
  args: [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
  ],
})
console.log('Chromium debug port ready on', DEBUG_PORT)

async function audit(url) {
  const result = await lighthouse(url, {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    port: DEBUG_PORT,
  })
  const lhr = result.lhr
  const scores = Object.fromEntries(
    Object.entries(lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)]),
  )
  console.log(url.padEnd(20), JSON.stringify(scores))
  return { url, scores, audits: Object.fromEntries(Object.entries(lhr.audits).map(([k, a]) => [k, { score: a.score, displayValue: a.displayValue, title: a.title }])) }
}

mkdirSync('e2e/artifacts/lighthouse', { recursive: true })
const results = []
for (const page of PAGES) {
  const r = await audit(BASE + page)
  results.push(r)
}
writeFileSync('e2e/artifacts/lighthouse/results.json', JSON.stringify(results, null, 2))
console.log('written e2e/artifacts/lighthouse/results.json')
await chrome.close()
