import { test, expect } from "@playwright/test";

// The direct-manipulation layer added with the UI redesign: the mode rail and
// its shortcuts, body drags, the pen, double-click vertex edits, the Pathfinder
// roles in the shape editor and the halftone image mode. Every control is
// addressed by an accessible name that is unique in the document — no
// `.first()`.

const stat = (page, id) => page.getByTestId(id);
const holes = page => stat(page, "stat-holes").textContent().then(t => Number(t.replace(/[^\d]/g, ""))); // prettier-ignore
const oar = page => stat(page, "stat-oar").textContent().then(parseFloat);

async function choose(page, dropdownLabel, optionLabel) {
  await page.getByRole("button", { name: dropdownLabel, exact: true }).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
}

// The canvas position of a sheet point, from the view maths in render/view.js
// at zoom 1 and no pan: the sheet is fitted with an 80 px margin about the
// canvas centre.
async function sheetToCanvas(page, x, y, sheetW = 200, sheetH = 200) {
  const box = await page.locator("canvas").boundingBox();
  const scale = Math.min((box.width - 80) / sheetW, (box.height - 80) / sheetH);
  return { x: box.width / 2 + (x - sheetW / 2) * scale, y: box.height / 2 + (y - sheetH / 2) * scale };
}

async function drag(page, from, to) {
  const canvas = page.locator("canvas");
  await canvas.hover({ position: from });
  await page.mouse.down();
  await canvas.hover({ position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } });
  await canvas.hover({ position: to });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(stat(page, "stat-holes")).toBeVisible();
  await page.locator("canvas").click({ position: { x: 20, y: 20 } }); // focus the page, not a field
});

test("the rail and the letter keys switch canvas modes, and Escape leaves them", async ({ page }) => {
  const rail = page.getByRole("toolbar", { name: "Canvas modes", exact: true });
  await expect(rail.getByRole("button", { name: "Select & pan mode", exact: true })).toHaveAttribute("aria-pressed", "true"); // prettier-ignore

  await page.keyboard.press("r");
  await expect(page.getByText("HOLE REMOVAL MODE", { exact: true })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Remove holes mode", exact: true })).toHaveAttribute("aria-pressed", "true"); // prettier-ignore

  await page.keyboard.press("g");
  await expect(page.getByText("EDIT VARIATION", { exact: true })).toBeVisible();
  await expect(page.getByText("HOLE REMOVAL MODE", { exact: true })).toHaveCount(0);

  await page.keyboard.press("f");
  await expect(page.getByText("SIZE FIELD", { exact: true })).toBeVisible();
  // The channel keys pick a channel while editing fields.
  await page.keyboard.press("3");
  await expect(page.getByText("ANGLE FIELD", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("ANGLE FIELD", { exact: true })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Select & pan mode", exact: true })).toHaveAttribute("aria-pressed", "true"); // prettier-ignore

  // B on a plain rectangle draws a polygon to edit rather than doing nothing.
  await page.keyboard.press("b");
  await expect(page.getByText("EDIT BOUNDARY", { exact: true })).toBeVisible();
  await expect(page.getByText("1 outline · 8 vertices")).toBeVisible();
  // …and that is one undo step, like any other edit.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(stat(page, "stat-holes")).toHaveText("739");

  // A letter typed into a text field is text, not a command.
  const name = page.getByLabel("Document name", { exact: true });
  await name.fill("");
  await name.pressSequentially("frb");
  await expect(name).toHaveValue("frb");
  await expect(page.getByText("SIZE FIELD", { exact: true })).toHaveCount(0);
});

test("a controller is dragged by its body, and Delete removes it", async ({ page }) => {
  await page.getByRole("switch", { name: "Field Controllers", exact: true }).click();
  await page.getByRole("button", { name: "Add line controller", exact: true }).click();
  const centred = await oar(page);
  // The line spans the middle of the sheet; grab it a little off its middle so
  // the press lands on the body and not on the reach handle above it.
  const from = await sheetToCanvas(page, 120, 100);
  const to = await sheetToCanvas(page, 120, 20);
  await drag(page, from, to);
  const moved = await oar(page);
  expect(moved).toBeLessThan(centred - 0.3);
  // One undo step for the whole drag.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  expect(await oar(page)).toBeCloseTo(centred, 1);

  await page.locator("canvas").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Delete");
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await expect(page.getByRole("button", { name: "Select size line controller 1", exact: true })).toHaveCount(0);
});

test("the pen draws a path click by click, and a double-click adds a vertex on the curve", async ({ page }) => {
  await choose(page, "Type", "Path");
  await page.getByRole("button", { name: "Edit path curves on the canvas", exact: true }).click();
  // Entering the mode hands over the default curve; Delete takes it away, so
  // the pen starts from nothing.
  await expect(page.getByRole("button", { name: "Select path 1", exact: true })).toContainText("4 pts");
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "Select path 1", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pen tool", exact: true })).toHaveAttribute("aria-pressed", "true");
  const canvas = page.locator("canvas");
  // No curve of its own now: the first click starts one, the next two extend it.
  for (const [x, y] of [
    [40, 160],
    [100, 40],
    [160, 160],
  ]) {
    await canvas.click({ position: await sheetToCanvas(page, x, y) });
  }
  await expect(page.getByRole("button", { name: "Select path 1", exact: true })).toContainText("3 pts");
  expect(await holes(page)).toBeGreaterThan(10);
  // Escape puts the pen away; the mode stays.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Pen tool", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/EDIT PATH/)).toBeVisible();

  // A double-click on the curve, between two vertices, puts one there. With
  // smoothing off the curve is the chord, so the midpoint of the first span
  // lies exactly on it.
  await page.getByRole("switch", { name: "Smooth the path through its points", exact: true }).click();
  await canvas.dblclick({ position: await sheetToCanvas(page, 70, 100) });
  await expect(page.getByRole("button", { name: "Select path 1", exact: true })).toContainText("4 pts");
  // And on a vertex, takes it away.
  await canvas.dblclick({ position: await sheetToCanvas(page, 70, 100) });
  await expect(page.getByRole("button", { name: "Select path 1", exact: true })).toContainText("3 pts");

  // Dragging the curve by its body moves the whole thing.
  const before = await holes(page);
  await drag(page, await sheetToCanvas(page, 130, 100), await sheetToCanvas(page, 130, 190));
  expect(await holes(page)).toBeLessThan(before);
});

test("the shape editor intersects and excludes, and handles are dragged on its canvas", async ({ page }) => {
  await page.getByRole("button", { name: "Open the shape editor", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Shape editor", exact: true });
  // A second disc beside the first; intersecting leaves only their overlap.
  await page.getByRole("button", { name: "Add circle layer", exact: true }).click();
  const x = page.getByLabel("Layer X", { exact: true });
  await x.fill("6");
  await x.press("Enter");
  const w = page.getByLabel("Layer Width", { exact: true });
  await w.fill("12");
  await w.press("Enter");
  const h = page.getByLabel("Layer Height", { exact: true });
  await h.fill("12");
  await h.press("Enter");
  await page.getByRole("button", { name: "Intersect role", exact: true }).click();
  // The lens of two ⌀12 discs 6 mm apart: 2r²·acos(d/2r) − (d/2)·√(4r² − d²) ≈ 44.2 mm².
  await expect(page.getByText(/1 piece · 4\d\.\d mm²/)).toBeVisible();
  await page.getByRole("button", { name: "Exclude role", exact: true }).click();
  await expect(page.getByText(/2 pieces · 13\d\.\d mm²/)).toBeVisible(); // 2·113.1 − 2·44.2

  // Ctrl+Z inside the editor undoes the editor's own stack, not the document.
  await page.keyboard.press("Control+z");
  await expect(page.getByText(/1 piece · 4\d\.\d mm²/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })).toBeDisabled();

  // Dragging the selected layer on the preview moves it; the numbers follow.
  const svg = dialog.getByLabel("Shape preview", { exact: true });
  const box = await svg.boundingBox();
  // The frame is a 30 mm square centred on (2.5, 0): x = 6 sits right of centre.
  const scale = Math.min(box.width, box.height) / 30;
  const cx = box.x + box.width / 2 + (6 - 2.5) * scale;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 2 * scale, cy, { steps: 4 });
  await page.mouse.move(cx + 4 * scale, cy, { steps: 4 });
  await page.mouse.up();
  await expect(x).toHaveValue(/^(9|10|11)(\.\d+)?$/);
  // Delete removes the selected layer.
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "Select layer 2", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel the shape editor", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("an image read as a halftone shrinks the holes under its dark pixels", async ({ page }) => {
  await page.getByRole("switch", { name: "Field Controllers", exact: true }).click();
  await page.getByRole("button", { name: "Add image controller", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 2, 1); // all black
    return canvas.toDataURL("image/png");
  });
  await page
    .getByLabel("Controller image", { exact: true })
    .setInputFiles({ name: "black.png", mimeType: "image/png", buffer: Buffer.from(png.split(",")[1], "base64") });
  await expect(page.getByText(/black\.png · 2×1/)).toBeVisible();
  // Black reads the neutral value at first, so nothing has changed yet.
  await expect(stat(page, "stat-ligament")).toHaveText("3.00 mm");
  // The halftone preset pulls the dark end down: small holes under the picture.
  await page.getByRole("button", { name: "Apply the halftone preset", exact: true }).click();
  await expect.poll(() => oar(page)).toBeLessThan(30);
  await expect(page.getByLabel("Dark → Size", { exact: true })).toHaveValue("0.15");
  // As a mask the same picture pulls nothing, so the pattern is back where it was.
  await page.getByRole("button", { name: "Read the image as a mask", exact: true }).click();
  await expect(stat(page, "stat-ligament")).toHaveText("3.00 mm");
});
