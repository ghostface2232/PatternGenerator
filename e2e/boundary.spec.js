import { test, expect } from "@playwright/test";

// The Phase 4 boundary: ellipse, polygon (drawn, and read from an SVG file),
// cutouts and the trim flag, in a real browser. Every control is addressed by
// an accessible name that is unique in the document — no `.first()`.

const stat = (page, id) => page.getByTestId(id);
const holes = page =>
  stat(page, "stat-holes")
    .textContent()
    .then(t => Number(t.replace(/[^\d]/g, "")));
const oar = page => stat(page, "stat-oar").textContent().then(parseFloat);
const shape = (page, name) => page.getByRole("button", { name: `${name} boundary`, exact: true }).click();

async function download(page, button) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// The canvas position of a sheet point, from the view maths in render/view.js
// at zoom 1 and no pan: the sheet is fitted with an 80 px margin about the
// canvas centre.
async function sheetToCanvas(page, x, y, sheetW = 200, sheetH = 200) {
  const box = await page.locator("canvas").boundingBox();
  const scale = Math.min((box.width - 80) / sheetW, (box.height - 80) / sheetH);
  return { x: box.width / 2 + (x - sheetW / 2) * scale, y: box.height / 2 + (y - sheetH / 2) * scale };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(stat(page, "stat-holes")).toBeVisible();
});

test("an ellipse boundary takes holes away and switches to the counted open area", async ({ page }) => {
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await shape(page, "Ellipse");
  const inside = await holes(page);
  expect(inside).toBeLessThan(739);
  expect(inside).toBeGreaterThan(400);
  // Counted over the ellipse, not the unit cell — and about the same figure,
  // since the pattern is the same pattern.
  const counted = await oar(page);
  expect(counted).toBeGreaterThan(30);
  expect(counted).toBeLessThan(40);
  // The corner radius is a rectangle's; the ellipse has none to offer.
  await expect(page.getByLabel("Corner Radius", { exact: true })).toHaveCount(0);
  await shape(page, "Rectangle");
  await expect(stat(page, "stat-holes")).toHaveText("739");
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
});

test("a cutout is a keep-out, edited on the canvas, and one undo step", async ({ page }) => {
  await page.getByRole("button", { name: "Add circle cutout", exact: true }).click();
  const fewer = await holes(page);
  expect(fewer).toBeLessThan(739);
  // Adding one enters boundary editing, with its badge, and selects it.
  await expect(page.getByText(/EDIT BOUNDARY/)).toBeVisible();
  await expect(page.getByLabel("Cutout Diameter", { exact: true })).toHaveValue("40");
  // A bigger cutout keeps fewer holes.
  const diameter = page.getByLabel("Cutout Diameter", { exact: true });
  await diameter.fill("80");
  await diameter.press("Enter");
  expect(await holes(page)).toBeLessThan(fewer);
  // Dragging its centre handle moves it: from the middle to the top-left
  // corner, where it takes fewer holes since much of it is off the sheet.
  const from = await sheetToCanvas(page, 100, 100);
  const to = await sheetToCanvas(page, 10, 10);
  await page.locator("canvas").hover({ position: from });
  await page.mouse.down();
  await page.locator("canvas").hover({ position: to });
  await page.mouse.up();
  await expect(page.getByLabel("Cutout X", { exact: true })).not.toHaveValue("100");
  // Removing it restores every hole, and undo brings it back.
  await page.getByRole("button", { name: "Remove cutout 1", exact: true }).click();
  await expect(stat(page, "stat-holes")).toHaveText("739");
  await page.getByTitle("Undo (Ctrl+Z)").click();
  expect(await holes(page)).toBeLessThan(739);
});

test("a polygon boundary starts as an octagon, gains a vertex on double-click, and survives a reload", async ({
  page,
}) => {
  await shape(page, "Polygon");
  const octagon = await holes(page);
  expect(octagon).toBeLessThan(739);
  await expect(page.getByText("1 outline · 8 vertices")).toBeVisible();
  await page.getByRole("button", { name: "Edit the boundary on the canvas", exact: true }).click();
  await expect(page.getByText(/EDIT BOUNDARY/)).toBeVisible();
  // The octagon's top edge runs along the top of the sheet; a double-click on
  // its middle puts a vertex there.
  const top = await sheetToCanvas(page, 100, 0);
  await page.locator("canvas").dblclick({ position: top });
  await expect(page.getByText("1 outline · 9 vertices")).toBeVisible();
  // Dragging that vertex down pulls the outline in and takes holes with it.
  const vertex = await sheetToCanvas(page, 100, 0);
  await page.locator("canvas").hover({ position: vertex });
  await page.mouse.down();
  const down = await sheetToCanvas(page, 100, 60);
  await page.locator("canvas").hover({ position: down });
  await page.mouse.up();
  const notched = await holes(page);
  expect(notched).toBeLessThan(octagon);
  // One undo step for the drag, one for the vertex.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  expect(await holes(page)).toBe(octagon);
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(page.getByText("1 outline · 8 vertices")).toBeVisible();
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  await page.reload();
  await expect.poll(() => holes(page)).toBe(notched);
  await expect(page.getByText("1 outline · 9 vertices")).toBeVisible();
  // And back to the rectangle is one click.
  await page.getByRole("button", { name: "Reset the boundary to the rectangle", exact: true }).click();
  await expect(stat(page, "stat-holes")).toHaveText("739");
});

test("an SVG file becomes the boundary at the size it states", async ({ page }) => {
  await shape(page, "Polygon");
  // A 150 mm circle with a 30 mm square counter, in a file that says so.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="200mm" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="75"/><rect x="85" y="85" width="30" height="30"/></svg>`;
  await page.getByLabel("Boundary outline file", { exact: true }).setInputFiles({ name: "grille.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) }); // prettier-ignore
  await expect(page.getByText(/2 outlines/)).toBeVisible();
  const count = await holes(page);
  // A 150 mm disc less a 30 mm square is about 43% of the sheet.
  expect(count).toBeGreaterThan(739 * 0.3);
  expect(count).toBeLessThan(739 * 0.55);
  const text = await download(page, "SVG");
  expect(text.match(/<circle /g)).toHaveLength(count);
  expect(text).toContain('clip-rule="evenodd"');
  // A file that is not an outline says so instead of blanking the sheet.
  await page.getByLabel("Boundary outline file", { exact: true }).setInputFiles({ name: "words.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg><text>hi</text></svg>") }); // prettier-ignore
  await expect(page.getByText(/no closed outline/)).toBeVisible();
  expect(await holes(page)).toBe(count);
});

test("trimming the sheet to the boundary changes the export, not the pattern", async ({ page }) => {
  await shape(page, "Ellipse");
  const count = await holes(page);
  await page.getByRole("switch", { name: "Trim sheet to boundary", exact: true }).click();
  expect(await holes(page)).toBe(count);
  const text = await download(page, "SVG");
  expect(text).toContain('<g id="OUTLINE" inkscape:label="OUTLINE" inkscape:groupmode="layer">');
  expect(text).not.toContain('<rect width="200" height="200"');
  expect(text.match(/<circle /g)).toHaveLength(count);
});

test("the four canvas modes are mutually exclusive", async ({ page }) => {
  await shape(page, "Polygon");
  const editBoundary = page.getByRole("button", { name: "Edit the boundary on the canvas", exact: true });
  await editBoundary.click();
  await expect(editBoundary).toHaveAttribute("aria-pressed", "true");
  const removal = page.getByRole("switch", { name: "Click to Remove", exact: true });
  await removal.scrollIntoViewIfNeeded();
  await removal.click();
  await expect(editBoundary).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
  await editBoundary.scrollIntoViewIfNeeded();
  await editBoundary.click();
  await expect(removal).toHaveAttribute("aria-checked", "false");
  // Randomize enters variation editing, which leaves boundary editing too.
  const randomize = page.getByRole("button", { name: "Randomize", exact: true });
  await randomize.scrollIntoViewIfNeeded();
  await randomize.click();
  await expect(page.getByText(/EDIT VARIATION/)).toHaveCount(1);
  await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
  await expect(editBoundary).toHaveAttribute("aria-pressed", "false");
});

test("boundary editing ends when there is nothing left to edit", async ({ page }) => {
  await shape(page, "Polygon");
  const editBoundary = page.getByRole("button", { name: "Edit the boundary on the canvas", exact: true });
  await editBoundary.click();
  await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(1);
  await page.getByRole("button", { name: "Reset the boundary to the rectangle", exact: true }).click();
  await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
  await expect(editBoundary).toHaveCount(0);
  // And undo, which brings the polygon back, does not bring the mode back.
  await page.keyboard.press("Control+z");
  await expect(editBoundary).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
});

test("a preset hole shape has its own parameters, and an SVG file becomes a custom one", async ({ page }) => {
  await page.getByRole("button", { name: "Hole Shape", exact: true }).click();
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await expect(page.getByLabel("Inner Radius", { exact: true })).toHaveValue("0.5");
  await expect(page.getByLabel("Points", { exact: true })).toHaveValue("5");
  const fiveStar = await oar(page);
  const points = page.getByLabel("Points", { exact: true });
  await points.fill("8");
  await points.press("Enter");
  expect(await oar(page)).not.toBe(fiveStar);
  await expect(stat(page, "stat-holes")).toHaveText("739");

  // A bar with a hole through it, from a file: the Custom shape, sized by the
  // width with the height following the outline's proportions.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" rx="5"/><circle cx="20" cy="10" r="4"/></svg>`;
  await page.getByLabel("Hole outline file", { exact: true }).setInputFiles({ name: "badge.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) }); // prettier-ignore
  await expect(page.getByText(/badge · 2 outlines/)).toBeVisible();
  await expect(page.getByLabel("Width (W)", { exact: true })).toHaveValue("5");
  await expect(page.getByText(/Height \(H\): 2\.50 mm/)).toBeVisible();
  const text = await download(page, "SVG");
  expect(text).toContain('fill-rule="evenodd"');
  // Releasing the lock hands the height back to its own slider.
  await page.getByRole("switch", { name: "Keep proportions", exact: true }).click();
  await expect(page.getByLabel("Height (H)", { exact: true })).toHaveValue("2.5");
});

test("the shape editor stacks shapes that add to or cut from the hole", async ({ page }) => {
  await page.getByRole("button", { name: "Open the shape editor", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Shape editor", exact: true });
  await expect(dialog).toBeVisible();
  // The stack opens with one disc; a second, cutting, makes a washer with a
  // bite — and the preview says one piece.
  await page.getByRole("button", { name: "Add circle layer", exact: true }).click();
  await page.getByRole("switch", { name: "Layer cuts from the hole", exact: true }).click();
  const x = page.getByLabel("Layer X", { exact: true });
  await x.fill("0");
  await x.press("Enter");
  const w = page.getByLabel("Layer Width", { exact: true });
  await w.fill("5");
  await w.press("Enter");
  const h = page.getByLabel("Layer Height", { exact: true });
  await h.fill("5");
  await h.press("Enter");
  await expect(page.getByText(/1 piece/)).toBeVisible();
  await page.getByRole("button", { name: "Apply the shape editor", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hole Shape", exact: true })).toHaveText(/Custom/);
  await expect(page.getByText(/from the shape editor/)).toBeVisible();
  await expect(stat(page, "stat-holes")).toHaveText("739");
  // A washer covers less than the disc did: the open area fell.
  const washer = await oar(page);
  expect(washer).toBeLessThan(35.4);
  const text = await download(page, "SVG");
  expect(text.match(/<path d="M /g)).toHaveLength(739);
  expect(text).toContain('fill-rule="evenodd"');
  // Reopening finds the stack, and cancelling changes nothing.
  await page.getByRole("button", { name: "Open the shape editor", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select layer 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel the shape editor", exact: true }).click();
  expect(await oar(page)).toBe(washer);
  // One undo step takes the whole shape back.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
});

for (const boundaryShape of ["Rectangle", "Ellipse", "Polygon"]) {
  test(`deleting the final cutout leaves ${boundaryShape} editing usable`, async ({ page }) => {
    await shape(page, boundaryShape);
    await page.getByRole("button", { name: "Add circle cutout", exact: true }).click();
    await expect(page.getByText(/EDIT BOUNDARY/)).toBeVisible();
    await page.getByRole("button", { name: "Remove cutout 1", exact: true }).click();
    if (boundaryShape === "Polygon") {
      await expect(page.getByText(/EDIT BOUNDARY/)).toBeVisible();
      await page.getByRole("button", { name: "Edit the boundary on the canvas", exact: true }).click();
    }
    await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
  });
}

for (const shortcut of ["preset", "randomize"]) {
  test(`variation ${shortcut} exits boundary editing`, async ({ page }) => {
    await shape(page, "Polygon");
    const editBoundary = page.getByRole("button", { name: "Edit the boundary on the canvas", exact: true });
    await editBoundary.click();
    await expect(page.getByText(/EDIT BOUNDARY/)).toBeVisible();
    if (shortcut === "preset") {
      await page.getByRole("button", { name: "Field preset", exact: true }).click();
      await page.getByRole("button", { name: "Center Bloom", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Randomize", exact: true }).click();
    }
    await expect(page.getByText(/EDIT VARIATION/)).toBeVisible();
    await expect(page.getByText(/EDIT BOUNDARY/)).toHaveCount(0);
    await expect(editBoundary).toHaveAttribute("aria-pressed", "false");
  });
}

test("small SVG circles import and unsupported proportions preserve the current hole", async ({ page }) => {
  const input = page.getByLabel("Hole outline file", { exact: true });
  await input.setInputFiles({
    name: "small.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg><circle r="0.1"/></svg>'),
  });
  await expect(page.getByText(/small · 1 outline/)).toBeVisible();
  const before = await oar(page);
  await input.setInputFiles({
    name: "thin.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg><rect width="100" height="1"/></svg>'),
  });
  await expect(page.getByText(/height-to-width ratio/)).toBeVisible();
  expect(await oar(page)).toBe(before);
  await expect(page.getByText(/small · 1 outline/)).toBeVisible();
});

test("the shape editor reports unsupported proportions and bounds new layer positions", async ({ page }) => {
  await page.getByRole("button", { name: "Open the shape editor", exact: true }).click();
  const width = page.getByLabel("Layer Width", { exact: true });
  const height = page.getByLabel("Layer Height", { exact: true });
  await width.fill("200");
  await width.press("Enter");
  await height.fill("0.1");
  await height.press("Enter");
  await page.getByRole("button", { name: "Apply the shape editor", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(/height-to-width ratio/);
  await expect(page.getByRole("dialog", { name: "Shape editor", exact: true })).toBeVisible();
  const x = page.getByLabel("Layer X", { exact: true });
  await x.fill("100");
  await x.press("Enter");
  // The numeric control itself clamps X to 50; successive automatic
  // placements must also stay within the document's larger 100 mm limit.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Add circle layer", exact: true }).click();
    await expect(page.getByRole("button", { name: `Select layer ${i + 2}`, exact: true })).toBeVisible();
  }
  await expect(x).toHaveValue("100");
  await page.getByRole("button", { name: "Cancel the shape editor", exact: true }).click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
});
