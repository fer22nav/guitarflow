import { test, expect, type Page } from "@playwright/test";
async function menu(page: Page, item: string) {
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
test("la pantalla principal no abre herramientas al tocar una nota", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Entre cuerdas", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("BIBLIOTECA", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Sonido de guía")).toHaveCount(0);
  await page.locator(".clean-board [data-note]").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu(page, "Ajustes");
  await expect(
    page.getByRole("dialog", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Sonido de guía")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("editar, guardar y recuperar desde los paneles", async ({ page }) => {
  await page.goto("/");
  await page.locator(".clean-board [data-note]").first().click();
  await menu(page, "Editar nota seleccionada");
  await page.getByLabel("Traste", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
  await expect(
    page.locator('.clean-board [data-fret="9"]').first(),
  ).toBeVisible();
  await menu(page, "Editar tablatura");
  await page.getByLabel("Título de canción").fill("Mi estudio");
  await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
  await expect(
    page.getByLabel("Guardado en este navegador", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mi estudio", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.clean-board [data-fret="9"]').first(),
  ).toBeVisible();
});
test("crear un fragmento con ambos extremos incluidos", async ({ page }) => {
  await page.goto("/");
  await menu(page, "Fragmentos");
  await page
    .getByRole("button", { name: "Seleccionar fragmento", exact: true })
    .click();
  const markers = page.locator(".clean-board [data-note]");
  await markers.nth(0).click();
  await markers.nth(3).click();
  await expect(
    page.getByRole("dialog", { name: "Fragmentos", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nombre del fragmento").fill("Mi frase");
  await page
    .getByRole("button", { name: "Guardar fragmento", exact: true })
    .click();
  await expect(page.getByText("Mi frase", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar panel", exact: true }).click();
  await page.getByRole("button", { name: "Bucle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bucle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("cargar ASCII conserva bends y notas repetidas", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Cargar tablatura", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Pegar texto", exact: true })
    .click();
  await page.getByLabel("Título de canción").fill("Prueba ASCII");
  await page
    .getByLabel("Tablatura ASCII")
    .fill(
      "e|--17b18--7--7--\nB|---------5-----\nG|---------------\nD|---------------\nA|---------------\nE|---------------",
    );
  await page
    .getByRole("button", { name: "Interpretar tablatura", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const svg = page.locator('.clean-board svg[role="img"]');
  await expect(svg.locator('[data-fret="17"]')).toHaveCount(1);
  await expect(svg.locator('[data-fret="18"]')).toHaveCount(0);
  await expect(svg.locator('[data-fret="7"]')).toHaveCount(2);
  await page
    .getByRole("button", { name: "Mástil físico", exact: true })
    .click();
  await expect(svg.locator('[data-fret="7"]')).toHaveCount(1);
});
