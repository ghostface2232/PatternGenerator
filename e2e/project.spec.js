import { test, expect } from "@playwright/test";

// Persistence, sharing and undo/redo (Phase 1).

async function setSlider(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

const stat = (page, id) => page.getByTestId(id);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(stat(page, "stat-holes")).toBeVisible();
});

test("edits survive a reload via localStorage autosave", async ({ page }) => {
  await setSlider(page, "Hole Diameter", 3);
  await page.getByLabel("Document name", { exact: true }).fill("Reload test");
  await page.getByLabel("Document name", { exact: true }).press("Enter");
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  const holes = await stat(page, "stat-holes").textContent();
  await page.reload();
  await expect(stat(page, "doc-name")).toHaveText("Reload test");
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("3");
  await expect(stat(page, "stat-holes")).toHaveText(holes);
});

test("New starts a fresh document and the old one is in Recent", async ({ page }) => {
  await page.getByLabel("Document name", { exact: true }).fill("Keep me");
  await page.getByLabel("Document name", { exact: true }).press("Enter");
  await setSlider(page, "X Edge Gap", 6);
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(stat(page, "doc-name")).toHaveText("Untitled");
  await expect(stat(page, "stat-holes")).toHaveText("739");
  await page.getByRole("button", { name: "Recent documents", exact: true }).click();
  await page.getByRole("button", { name: /^Keep me/ }).click();
  await expect(stat(page, "doc-name")).toHaveText("Keep me");
  await expect(page.getByLabel("X Edge Gap", { exact: true })).toHaveValue("6");
});

test("share link reopens the exact document in a fresh context", async ({ page, browser }) => {
  await setSlider(page, "Hole Diameter", 4.2);
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByRole("button", { name: "Straight", exact: true }).click();
  const holes = await stat(page, "stat-holes").textContent();
  const oar = await stat(page, "stat-oar").textContent();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/#d=/);

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto(url);
  await expect(stat(page2, "stat-holes")).toHaveText(holes);
  await expect(stat(page2, "stat-oar")).toHaveText(oar);
  await expect(page2.getByLabel("Hole Diameter", { exact: true })).toHaveValue("4.2");
  expect(page2.url()).not.toContain("#d=");
  await other.close();
});

test("save downloads a .perf.json that opens again", async ({ page }) => {
  await setSlider(page, "Panel Width", 150);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.perf\.json$/);
  const path = await download.path();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByLabel("Panel Width", { exact: true })).toHaveValue("200");
  await page.getByLabel("Open document file", { exact: true }).setInputFiles(path);
  await expect(page.getByLabel("Panel Width", { exact: true })).toHaveValue("150");
});

test("undo and redo walk through edits, and a slider drag is one step", async ({ page }) => {
  await setSlider(page, "Hole Diameter", 3);
  await expect(stat(page, "stat-oar")).not.toHaveText("35.4");
  await page.getByRole("button", { name: "Hole Shape", exact: true }).click();
  await page.getByRole("button", { name: "Hexagon", exact: true }).click();
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(page.getByRole("button", { name: "Hole Shape", exact: true })).toHaveText("Circle");
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("3");
  // Keyboard: Ctrl+Z from the canvas
  await page.locator("canvas").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+z");
  await expect(stat(page, "stat-oar")).toHaveText("35.4");

  // A range-slider drag emits many changes but should undo in one step.
  const slider = page.locator('input[type="range"]').first(); // Hole Diameter
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + box.width * 0.23, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.23 + i * 0.05), box.y + box.height / 2);
  await page.mouse.up();
  const dragged = await page.getByLabel("Hole Diameter", { exact: true }).inputValue();
  expect(Number(dragged)).toBeGreaterThan(5);
  await page.keyboard.press("Control+z");
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("5");
});
