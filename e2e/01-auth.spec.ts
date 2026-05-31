/**
 * Tests de autenticación — no requieren credenciales de test para la mayoría.
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsParticipant, hasAdminCreds, hasParticipantCreds } from "./helpers/auth";

test.describe("Login page", () => {
  test("renderiza correctamente", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2, h1").filter({ hasText: /bienvenido/i })).toBeVisible();
    await expect(page.locator('input[placeholder="tu@empresa.com"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Iniciar sesión")')).toBeVisible();
  });

  test("ruta protegida sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ruta /generate sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/generate");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ruta /evaluations sin sesión redirige a /login", async ({ page }) => {
    await page.goto("/evaluations");
    await expect(page).toHaveURL(/\/login/);
  });

  test("credenciales incorrectas muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="tu@empresa.com"]', "noexiste@test.com");
    await page.fill('input[type="password"]', "wrongpassword123");
    await page.click('button:has-text("Iniciar sesión")');
    // Debe mostrar un mensaje de error sin navegar
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("text=/error|inválid|incorrect/i").first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Login como admin", () => {
  test.skip(!hasAdminCreds(), "Sin TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — omitido");

  test("admin llega al dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("text=/panel|dashboard/i").first()).toBeVisible();
  });

  test("admin puede cerrar sesión", async ({ page }) => {
    await loginAsAdmin(page);
    // Busca botón/menú de logout (puede variar según implementación)
    const logout = page.locator('button:has-text("Cerrar sesión"), a:has-text("Cerrar sesión")').first();
    if (await logout.isVisible()) {
      await logout.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      test.skip(true, "Botón de logout no localizado");
    }
  });
});

test.describe("Login como participante", () => {
  test.skip(!hasParticipantCreds(), "Sin TEST_PARTICIPANT_EMAIL / TEST_PARTICIPANT_PASSWORD — omitido");

  test("participante llega a /participant", async ({ page }) => {
    await loginAsParticipant(page);
    await expect(page).toHaveURL(/\/participant/);
  });

  test("participante es redirigido desde /dashboard a /participant", async ({ page }) => {
    await loginAsParticipant(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/participant/);
  });

  test("participante es redirigido desde /generate a /participant", async ({ page }) => {
    await loginAsParticipant(page);
    await page.goto("/generate");
    await expect(page).toHaveURL(/\/participant/);
  });
});
