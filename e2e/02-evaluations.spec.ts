/**
 * Tests de gestión de evaluaciones.
 * Requiere: TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en .env
 *
 * Cubre:
 *  - UI de la página de evaluaciones
 *  - Feature: Duplicar evaluación (#3)
 *  - Feature: Vista previa de evaluación (#6)
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin, hasAdminCreds } from "./helpers/auth";

test.describe("Evaluaciones (admin)", () => {
  test.skip(!hasAdminCreds(), "Sin credenciales de admin — omitido");

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/evaluations");
    await page.waitForLoadState("networkidle");
  });

  test("página carga y muestra el botón 'Nueva Evaluación'", async ({ page }) => {
    await expect(page.locator('button:has-text("Nueva Evaluación")')).toBeVisible();
  });

  test("crear evaluación abre el modal de creación", async ({ page }) => {
    await page.click('button:has-text("Nueva Evaluación")');
    await expect(page.locator("text=Nueva Evaluación").nth(1)).toBeVisible();
    await expect(page.locator('input[placeholder*="Evaluación"]')).toBeVisible();
  });

  test("cancelar creación cierra el modal sin crear", async ({ page }) => {
    const countBefore = await page.locator('[class*="rounded-xl"][class*="border"]').count();
    await page.click('button:has-text("Nueva Evaluación")');
    await page.click('button:has-text("Cancelar")');
    await expect(page.locator("text=Nueva Evaluación").first()).not.toBeVisible();
    const countAfter = await page.locator('[class*="rounded-xl"][class*="border"]').count();
    expect(countAfter).toBe(countBefore);
  });

  // ── Feature #3: Duplicar evaluación ──────────────────────────────────────
  test("cada card de evaluación tiene botón Duplicar", async ({ page }) => {
    const cards = page.locator('[title="Duplicar evaluación"]');
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "No hay evaluaciones creadas — crear al menos una para probar");
    }
    expect(count).toBeGreaterThan(0);
  });

  test("duplicar evaluación crea copia con prefijo 'Copia de'", async ({ page }) => {
    const firstDuplicate = page.locator('[title="Duplicar evaluación"]').first();
    if (!(await firstDuplicate.isVisible())) {
      test.skip(true, "No hay evaluaciones para duplicar");
    }

    // Obtener nombre de la primera evaluación
    const firstCardName = await page.locator("h3").first().innerText();
    await firstDuplicate.click();

    // Esperar el toast de confirmación
    await expect(page.locator("text=/Copia de/i")).toBeVisible({ timeout: 10_000 });

    // La copia debe aparecer en la lista
    const copy = page.locator(`h3:has-text("Copia de ${firstCardName}")`);
    await expect(copy).toBeVisible({ timeout: 5000 });
  });

  test("copia creada aparece como INACTIVA", async ({ page }) => {
    const firstDuplicate = page.locator('[title="Duplicar evaluación"]').first();
    if (!(await firstDuplicate.isVisible())) {
      test.skip(true, "No hay evaluaciones para duplicar");
    }
    await firstDuplicate.click();
    await page.waitForTimeout(2000);
    // La nueva card debe tener badge INACTIVA
    const inactiveBadge = page.locator("text=INACTIVA").first();
    await expect(inactiveBadge).toBeVisible({ timeout: 8000 });
  });

  // ── Feature #6: Vista previa de evaluación ───────────────────────────────
  test("cada card tiene botón de Vista Previa (ojo)", async ({ page }) => {
    const previewBtns = page.locator('[title="Vista previa"]');
    const count = await previewBtns.count();
    if (count === 0) {
      test.skip(true, "No hay evaluaciones para previsualizar");
    }
    expect(count).toBeGreaterThan(0);
  });

  test("vista previa abre modal con badge 'VISTA PREVIA'", async ({ page }) => {
    const firstPreview = page.locator('[title="Vista previa"]').first();
    if (!(await firstPreview.isVisible())) {
      test.skip(true, "No hay evaluaciones para previsualizar");
    }
    await firstPreview.click();
    await expect(page.locator("text=VISTA PREVIA")).toBeVisible({ timeout: 8000 });
  });

  test("modal de vista previa muestra info de la evaluación", async ({ page }) => {
    const firstPreview = page.locator('[title="Vista previa"]').first();
    if (!(await firstPreview.isVisible())) {
      test.skip(true, "No hay evaluaciones para previsualizar");
    }
    await firstPreview.click();
    // Debe mostrar info: preguntas, badge de advertencia
    await expect(page.locator("text=/preguntas/i").first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=/sin registro de respuestas/i")).toBeVisible();
  });

  test("cerrar vista previa cierra el modal", async ({ page }) => {
    const firstPreview = page.locator('[title="Vista previa"]').first();
    if (!(await firstPreview.isVisible())) {
      test.skip(true, "No hay evaluaciones para previsualizar");
    }
    await firstPreview.click();
    await expect(page.locator("text=VISTA PREVIA")).toBeVisible({ timeout: 8000 });
    await page.click('button:has-text("Cerrar Vista Previa")');
    await expect(page.locator("text=VISTA PREVIA")).not.toBeVisible();
  });

  // ── Búsqueda y filtros ────────────────────────────────────────────────────
  test("filtro de búsqueda filtra evaluaciones por nombre", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Buscar evaluaciones…"]');
    await searchInput.fill("xyzno_existe_esto");
    await expect(page.locator("text=/0 de/")).toBeVisible();
    await searchInput.clear();
  });
});
