import { Page } from "@playwright/test";

export const hasAdminCreds = () =>
  !!(process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD);

export const hasParticipantCreds = () =>
  !!(process.env.TEST_PARTICIPANT_EMAIL && process.env.TEST_PARTICIPANT_PASSWORD);

export async function loginAsAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error("Requiere TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en .env");
  await page.goto("/login");
  await page.fill('input[placeholder="tu@empresa.com"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

export async function loginAsParticipant(page: Page) {
  const email = process.env.TEST_PARTICIPANT_EMAIL;
  const password = process.env.TEST_PARTICIPANT_PASSWORD;
  if (!email || !password)
    throw new Error("Requiere TEST_PARTICIPANT_EMAIL y TEST_PARTICIPANT_PASSWORD en .env");
  await page.goto("/login");
  await page.fill('input[placeholder="tu@empresa.com"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForURL(/\/participant/, { timeout: 15_000 });
}
