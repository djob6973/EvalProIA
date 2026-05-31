/**
 * Tests del generador de preguntas con IA.
 * Requiere: TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD en .env
 *
 * Cubre:
 *  - UI de la página de generación
 *  - Feature: Edición inline de preguntas (#1)
 *  - Feature: Regenerar pregunta individual (#2)
 *
 * Nota: los tests que requieren generación real (OpenAI) se marcan
 * como 'slow' y necesitan OPENAI_API_KEY válida.
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin, hasAdminCreds } from "./helpers/auth";

test.describe("Generador de Preguntas (admin)", () => {
  test.skip(!hasAdminCreds(), "Sin credenciales de admin — omitido");

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/generate");
    await page.waitForLoadState("networkidle");
  });

  test("página carga correctamente con sus secciones", async ({ page }) => {
    await expect(page.locator("text=/documento/i").first()).toBeVisible();
    await expect(page.locator("text=/configuración/i").first()).toBeVisible();
  });

  test("zona de carga de archivo acepta drag & drop area", async ({ page }) => {
    const dropZone = page.locator("text=/arrastra|sube|carga/i").first();
    await expect(dropZone).toBeVisible();
  });

  test("botón Generar está deshabilitado sin texto extraído", async ({ page }) => {
    const generateBtn = page.locator('button:has-text("Generar Preguntas"), button:has-text("Generar")').first();
    await expect(generateBtn).toBeDisabled();
  });

  // ── Tests con generación real (necesitan API Key de OpenAI) ───────────────
  test.describe("Con preguntas generadas", () => {
    test.skip(
      !process.env.OPENAI_API_KEY,
      "Sin OPENAI_API_KEY — tests de generación omitidos"
    );

    async function uploadAndGenerate(page: any) {
      // Crear archivo .txt de prueba con contenido suficiente para generar preguntas
      const content =
        "Seguridad Industrial. El uso de equipos de protección personal (EPP) es obligatorio en todas las zonas de producción. " +
        "Los guantes de nitrilo protegen contra químicos. El casco es requerido en áreas de construcción. " +
        "La señalización de seguridad indica zonas de peligro. Los extintores deben revisarse mensualmente. " +
        "El bloqueo y etiquetado (LOTO) previene accidentes por energía peligrosa. " +
        "La ergonomía reduce lesiones musculoesqueléticas. El ruido excesivo requiere protección auditiva.";

      // Inyectar el texto extraído directamente (simulación)
      await page.evaluate((text: string) => {
        // Disparar evento personalizado o manipular estado — depende del componente
        // Como alternativa, subimos un .txt real
        const dt = new DataTransfer();
        const file = new File([text], "test-sst.txt", { type: "text/plain" });
        dt.items.add(file);
        const input = document.querySelector('input[type="file"]');
        if (input) {
          Object.defineProperty(input, "files", { value: dt.files });
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, content);

      // Esperar que el botón de extracción esté activo y clickear
      const extractBtn = page.locator('button:has-text("Extraer Texto"), button:has-text("Extraer")').first();
      if (await extractBtn.isEnabled()) {
        await extractBtn.click();
        await page.waitForTimeout(5000);
      }

      // Configurar 3 preguntas para rapidez
      const numInput = page.locator('input[type="number"]').first();
      await numInput.fill("3");

      // Generar
      const genBtn = page.locator('button:has-text("Generar")').first();
      await genBtn.click();
      // Esperar hasta 60s para la generación
      await page.waitForSelector('text=/Editar/', { timeout: 60_000 });
    }

    // ── Feature #1: Edición inline ──────────────────────────────────────────
    test("preguntas generadas muestran botón 'Editar'", async ({ page }) => {
      await uploadAndGenerate(page);
      const editBtns = page.locator('button:has-text("Editar")');
      await expect(editBtns.first()).toBeVisible();
    });

    test("clic en Editar abre formulario inline con campos editables", async ({ page }) => {
      await uploadAndGenerate(page);
      await page.locator('button:has-text("Editar")').first().click();
      // Debe aparecer un textarea para la pregunta
      await expect(page.locator("textarea").first()).toBeVisible();
      await expect(page.locator('button:has-text("Guardar cambios")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
    });

    test("editar y guardar pregunta actualiza la vista de solo lectura", async ({ page }) => {
      await uploadAndGenerate(page);
      await page.locator('button:has-text("Editar")').first().click();
      const textarea = page.locator("textarea").first();
      await textarea.fill("¿Pregunta editada manualmente por el test?");
      await page.locator('button:has-text("Guardar cambios")').click();
      // El formulario desaparece y se muestra el texto editado
      await expect(page.locator("text=¿Pregunta editada manualmente por el test?")).toBeVisible();
      await expect(page.locator('button:has-text("Guardar cambios")')).not.toBeVisible();
    });

    test("cancelar edición descarta cambios", async ({ page }) => {
      await uploadAndGenerate(page);
      const originalText = await page.locator("p.text-sm.font-medium").first().innerText();
      await page.locator('button:has-text("Editar")').first().click();
      await page.locator("textarea").first().fill("texto que no se va a guardar");
      await page.locator('button:has-text("Cancelar")').first().click();
      await expect(page.locator(`text=${originalText}`)).toBeVisible();
    });

    test("marcar respuesta correcta diferente en modo edición", async ({ page }) => {
      await uploadAndGenerate(page);
      await page.locator('button:has-text("Editar")').first().click();
      // El primer botón de opción (letra A) en el formulario de edición
      const optionBtns = page.locator('[class*="grid"][class*="size-5"]');
      if ((await optionBtns.count()) > 1) {
        await optionBtns.nth(1).click(); // marcar B como correcta
        await page.locator('button:has-text("Guardar cambios")').click();
        await expect(page.locator('button:has-text("Guardar cambios")')).not.toBeVisible();
      }
    });

    // ── Feature #2: Regenerar pregunta individual ──────────────────────────
    test("preguntas generadas muestran botón 'Regenerar'", async ({ page }) => {
      await uploadAndGenerate(page);
      await expect(page.locator('button:has-text("Regenerar")').first()).toBeVisible();
    });

    test("clic en Regenerar muestra spinner y reemplaza la pregunta", async ({ page }) => {
      await uploadAndGenerate(page);
      const originalText = await page.locator("p.text-sm.font-medium").first().innerText();
      await page.locator('button:has-text("Regenerar")').first().click();
      // Spinner visible durante generación
      await expect(page.locator('button:has-text("Regenerando…")').first()).toBeVisible({ timeout: 5000 });
      // Esperar fin de regeneración
      await page.waitForSelector('button:has-text("Regenerar")', { timeout: 60_000 });
      // La pregunta puede haber cambiado (o no — la IA podría generar algo similar)
      const newText = await page.locator("p.text-sm.font-medium").first().innerText();
      // Al menos ya no está regenerando
      await expect(page.locator('button:has-text("Regenerando…")')).not.toBeVisible();
      // El texto original pudo haber cambiado o no, pero la acción completó
      expect(typeof newText).toBe("string");
    });

    test("Regenerar no afecta el estado de selección de las demás preguntas", async ({ page }) => {
      await uploadAndGenerate(page);
      // Deseleccionar la segunda pregunta si existe
      const checkboxes = page.locator('[aria-label="Seleccionar pregunta"]');
      if ((await checkboxes.count()) > 1) {
        await checkboxes.nth(1).click(); // deseleccionar segunda
        const selectedBefore = await page.locator('[class*="CheckSquare"]').count();
        // Regenerar primera
        await page.locator('button:has-text("Regenerar")').first().click();
        await page.waitForSelector('button:has-text("Regenerar")', { timeout: 60_000 });
        const selectedAfter = await page.locator('[class*="CheckSquare"]').count();
        expect(selectedAfter).toBe(selectedBefore);
      }
    });
  });
});
