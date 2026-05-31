/**
 * Tests de páginas de resultados.
 * Requiere: TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en .env
 *
 * Cubre:
 *  - Feature: Exportar CSV en /results (#4)
 *  - Feature: Exportar CSV en /evaluation-results/:id (#4)
 *  - Feature: Analytics por pregunta en /evaluation-results/:id (#5)
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin, hasAdminCreds } from "./helpers/auth";

test.describe("Resultados Globales — /results", () => {
  test.skip(!hasAdminCreds(), "Sin credenciales de admin — omitido");

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/results");
    await page.waitForLoadState("networkidle");
  });

  test("página carga correctamente con KPIs", async ({ page }) => {
    await expect(page.locator("text=/sesiones totales/i")).toBeVisible();
    await expect(page.locator("text=/tasa de aprobación/i")).toBeVisible();
    await expect(page.locator("text=/mejor puntaje/i")).toBeVisible();
  });

  // ── Feature #4: Exportar CSV ───────────────────────────────────────────
  test("botón 'Exportar CSV' es visible en el header", async ({ page }) => {
    await expect(page.locator('button:has-text("Exportar CSV")')).toBeVisible();
  });

  test("clic en 'Exportar CSV' dispara descarga de archivo .csv", async ({ page }) => {
    const exportBtn = page.locator('button:has-text("Exportar CSV")');

    // Verificar que el botón no esté disabled cuando hay datos (puede estarlo si no hay resultados)
    const isDisabled = await exportBtn.isDisabled();
    if (isDisabled) {
      test.skip(true, "Sin resultados en el sistema — botón deshabilitado");
    }

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^resultados-globales-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("gráfica de tendencia semanal está presente", async ({ page }) => {
    await expect(page.locator("text=/promedio semanal/i")).toBeVisible();
  });

  test("distribución de puntajes está presente", async ({ page }) => {
    await expect(page.locator("text=/distribución de puntajes/i")).toBeVisible();
  });

  test("filtro por año existe y es seleccionable", async ({ page }) => {
    const yearSelect = page.locator("select").first();
    await expect(yearSelect).toBeVisible();
  });
});

test.describe("Resultados por Evaluación — /evaluation-results/:id", () => {
  test.skip(!hasAdminCreds(), "Sin credenciales de admin — omitido");

  let evalId = "";

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);

    // Obtener el ID de la primera evaluación desde /evaluations
    await page.goto("/evaluations");
    await page.waitForLoadState("networkidle");

    const resultsLink = page.locator('a[href*="/evaluation-results/"]').first();
    if (!(await resultsLink.isVisible())) {
      test.skip(true, "No hay evaluaciones — crear al menos una para probar");
    }

    const href = await resultsLink.getAttribute("href");
    evalId = href?.split("/evaluation-results/")?.[1] ?? "";
    if (!evalId) test.skip(true, "No se pudo obtener ID de evaluación");

    await page.goto(`/evaluation-results/${evalId}`);
    await page.waitForLoadState("networkidle");
  });

  test("página carga y muestra KPIs de la evaluación", async ({ page }) => {
    await expect(page.locator("text=/participantes/i").first()).toBeVisible();
    await expect(page.locator("text=/promedio/i").first()).toBeVisible();
    await expect(page.locator("text=/tasa aprobación/i")).toBeVisible();
  });

  // ── Feature #4: Exportar CSV ───────────────────────────────────────────
  test("botón 'Exportar CSV' aparece en el header junto a 'Volver'", async ({ page }) => {
    await expect(page.locator('button:has-text("Exportar CSV")')).toBeVisible();
    await expect(page.locator('a:has-text("Volver a Evaluaciones")')).toBeVisible();
  });

  test("clic en 'Exportar CSV' descarga archivo con nombre de la evaluación", async ({ page }) => {
    const exportBtn = page.locator('button:has-text("Exportar CSV")');
    const isDisabled = await exportBtn.isDisabled();
    if (isDisabled) {
      test.skip(true, "Evaluación sin resultados — botón deshabilitado");
    }

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^resultados-.+\.csv$/);
  });

  // ── Feature #5: Analytics por pregunta ─────────────────────────────────
  test("sección 'Analytics por Pregunta' aparece cuando hay resultados", async ({ page }) => {
    // Esta sección sólo aparece si hay resultados con respuestas registradas
    const analyticsSection = page.locator("text=Analytics por Pregunta");
    const hasResults = await page.locator("text=Analytics por Pregunta").isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasResults) {
      test.skip(true, "Evaluación sin resultados con respuestas — sección no visible");
    }

    await expect(analyticsSection).toBeVisible();
  });

  test("analytics muestra tasas de error con barras de progreso", async ({ page }) => {
    const analyticsSection = page.locator("text=Analytics por Pregunta");
    if (!(await analyticsSection.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Sin resultados — sección analytics no visible");
    }

    // Debe mostrar al menos un '% errores'
    await expect(page.locator("text=% errores").first()).toBeVisible();
  });

  test("analytics ordena de mayor a menor tasa de error", async ({ page }) => {
    const analyticsSection = page.locator("text=Analytics por Pregunta");
    if (!(await analyticsSection.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Sin resultados — sección analytics no visible");
    }

    // Obtener los valores de error como números
    const errorRates = await page.locator("text=% errores").allInnerTexts();
    const nums = errorRates.map((t) => parseInt(t.replace("% errores", "").trim()));
    const sorted = [...nums].sort((a, b) => b - a);
    expect(nums).toEqual(sorted);
  });

  test("tabla de resultados por participante está presente", async ({ page }) => {
    const table = page.locator("table");
    const noResults = page.locator("text=/no hay resultados/i");
    const either = await Promise.race([
      table.isVisible().then((v) => ({ type: "table", visible: v })),
      noResults.isVisible().then((v) => ({ type: "empty", visible: v })),
    ]);
    expect(either.visible).toBe(true);
  });
});
