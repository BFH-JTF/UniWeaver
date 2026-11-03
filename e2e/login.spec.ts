import { expect, test } from '@playwright/test'

const ADMIN_USER = 'admin'
const ADMIN_PASSWORD = 'e2e-test-password-1'

/**
 * E2E-Flow «Login → Portal»: Portal öffnen → per docPouch-OIDC einloggen →
 * Portal zeigt den angemeldeten User. Der Client ist als gepinnter Client
 * (OIDC_CLIENT_ID=uniweaver-local, auto-consent) konfiguriert; der
 * docPouch-Consent-Screen wird deshalb nicht angezeigt.
 */
test('Login über docPouch endet im Portal', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/user_entry/)
  const loginButton = page.getByRole('button', { name: /docpouch/i })
  await expect(loginButton).toBeVisible()

  await loginButton.first().click()
  // OIDC: /oidc/auth → docPouch-Interaction-Loginseite (gleiche Origin)
  await page.waitForURL(/interaction\//, { timeout: 20000 })
  await page.getByRole('textbox', { name: 'Username' }).first().fill(ADMIN_USER)
  await page.getByRole('textbox', { name: 'Password' }).first().fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).first().click()

  // Zurück im Portal: Willkommen + User sichtbar
  await page.waitForURL(/user_entry\/$/, { timeout: 20000 })
  await expect(page.getByText(/welcome/i).first()).toBeVisible({ timeout: 15000 })
})

/* Der docPouch-Loginzustand ist ein Server-Cookie (_session): ein ungeloggtes
 * Browserprofil, das ein Tool direkt öffnet, landet im Portal-Login. */
test('Direkter Tool-Aufruf ohne Login leitet zur Login-Ansicht', async ({ page }) => {
  await page.goto('/scheduling/')
  await expect(page).toHaveURL(/user_entry/, { timeout: 15000 })
})

/* Einloggen → Tool öffnen → zurück: deckt den zweiten Hauptablauf ab. */
test('Eingeloggter User kann die Scheduling-App öffnen', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/')
  await page.getByRole('button', { name: /docpouch/i }).first().click()
  await page.waitForURL(/interaction\//, { timeout: 20000 })
  await page.getByRole('textbox', { name: 'Username' }).first().fill(ADMIN_USER)
  await page.getByRole('textbox', { name: 'Password' }).first().fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.waitForURL(/user_entry\/$/, { timeout: 20000 })

  // Tool-Link im Portal → Scheduling-Ansicht lädt
  await page.goto('/scheduling/')
  await expect(page).toHaveURL(/scheduling/, { timeout: 15000 })
  await expect(page.getByText(/planning|scheduling|mapping/i).first()).toBeVisible()
  await page.screenshot({ path: 'e2e/artifacts/scheduling-after-login.png', fullPage: true })

  await context.close()
})