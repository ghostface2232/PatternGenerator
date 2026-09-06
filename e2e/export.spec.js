import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
async function download(page, format) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download ${format}`, exact: true }).click();
  const file = await pending;
  return { name: file.suggestedFilename(), data: await readFile(await file.path()) };
}
test("export dialog produces inch DXF with chosen layers and filename without an undo edit", async ({ page }) => {
  await page.getByRole("button", { name: "Export pattern", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("739 holes");
  await page.getByLabel("Export format").selectOption("DXF");
  await page.getByLabel("Export units").selectOption("inch");
  await page.getByLabel("Export OUTLINE").uncheck();
  await page.getByLabel("Export KEEPOUT").uncheck();
  await page.getByLabel("Export filename").fill("speaker_test");
  const { name, data } = await download(page, "DXF");
  expect(name).toBe("speaker_test.dxf");
  expect(data.toString()).toContain("$INSUNITS\n70\n1\n");
  expect(data.toString()).toContain("8\nHOLES\n");
  expect(data.toString()).not.toContain("8\nOUTLINE\n");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })).toBeDisabled();
});
test("cut SVG clips contours and applies kerf; blank kerf and empty layers block download", async ({ page }) => {
  await page.getByRole("button", { name: "Export pattern", exact: true }).click();
  await page.getByLabel("Kerf width (mm)").fill("");
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeDisabled();
  await page.getByLabel("Kerf width (mm)").fill("0.2");
  for (const layer of ["OUTLINE", "HOLES", "KEEPOUT"]) await page.getByLabel(`Export ${layer}`).uncheck();
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeDisabled();
  await page.getByLabel("Export HOLES").check();
  const { data } = await download(page, "SVG");
  const svg = data.toString();
  expect(svg).toContain('r="2.4"');
  expect(svg).toContain('fill="none"');
  expect(svg).not.toContain("clipPath");
  expect(svg).not.toContain('id="OUTLINE"');
});
test("PNG ignores invalid vector settings and writes a raster file", async ({ page }) => {
  await page.getByRole("button", { name: "Export pattern", exact: true }).click();
  await page.getByLabel("Kerf width (mm)").fill("");
  await page.getByLabel("Export format").selectOption("PNG");
  await expect(page.getByLabel("Export units")).toBeDisabled();
  const { data } = await download(page, "PNG");
  expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
test("dialog traps focus, Escape restores focus, and remains within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  const trigger = page.getByRole("button", { name: "Export pattern", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog");
  const box = await modal.boundingBox();
  expect(box.x).toBeGreaterThan(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(650);
  await page.getByRole("button", { name: "Close export dialog" }).press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("dropping a document onto the export modal cannot replace the current document", async ({ page }) => {
  await page.getByRole("button", { name: "Export pattern", exact: true }).click();
  const prevented = await page.getByRole("dialog").evaluate(el => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(
        [
          JSON.stringify({
            schemaVersion: 1,
            name: "Wrong document",
            sheet: { w: 100, h: 100 },
            hole: { shape: "Circle", diameter: 5 },
          }),
        ],
        "wrong.perf.json",
        { type: "application/json" }
      )
    );
    const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.getByRole("dialog")).toContainText("739 holes");
  await expect(page.getByLabel("Export filename")).toHaveValue("Untitled");
  await page.getByRole("button", { name: "Close export dialog" }).click();
  await expect(page.getByTestId("doc-name")).toHaveText("Untitled");
  await expect(page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })).toBeDisabled();
});
