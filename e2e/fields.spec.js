import { test, expect } from "@playwright/test";

// Field controllers, the morph shape and image controllers (Phase 2).

const stat = (page, id) => page.getByTestId(id);
const oar = page => stat(page, "stat-oar").textContent().then(parseFloat);

async function choose(page, dropdownLabel, optionLabel) {
  await page.getByRole("button", { name: dropdownLabel, exact: true }).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
}

async function setSlider(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

// The fields panel sits below the variation card; scroll it into view first so
// the clicks below are not intercepted by the sticky cards above.
async function enableFields(page) {
  const toggle = page.getByRole("switch", { name: "Field Controllers", exact: true });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

const addController = async (page, kind) => {
  const button = page.getByRole("button", { name: `Add ${kind} controller`, exact: true }).first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(stat(page, "stat-holes")).toBeVisible();
});

test("a size controller grows the holes it reaches and lifts the open area", async ({ page }) => {
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await enableFields(page);
  await addController(page, "point");
  // The pattern keeps every hole; only their size changed.
  await expect(stat(page, "stat-holes")).toHaveText("739");
  expect(await oar(page)).toBeGreaterThan(35.4);

  // Turning the block off puts the theoretical figure back, exactly.
  const toggle = page.getByRole("switch", { name: "Field Controllers", exact: true });
  await toggle.click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await toggle.click();
  expect(await oar(page)).toBeGreaterThan(35.4);

  // The reach is what decides how much of the sheet it touches.
  const wide = await oar(page);
  await setSlider(page, "Reach", 10);
  expect(await oar(page)).toBeLessThan(wide);
});

test("a controller is one undo step, and its drag is another", async ({ page }) => {
  await enableFields(page);
  await addController(page, "point");
  const grown = await oar(page);
  await setSlider(page, "Target Size", 3);
  expect(await oar(page)).toBeGreaterThan(grown);

  await page.getByTitle("Undo (Ctrl+Z)").click();
  expect(await oar(page)).toBeCloseTo(grown, 1);
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4"); // the controller is gone
  await page.getByTitle("Redo (Ctrl+Shift+Z)").click();
  expect(await oar(page)).toBeCloseTo(grown, 1);
});

test("controllers survive a reload and a share link", async ({ page, browser }) => {
  await enableFields(page);
  await addController(page, "line");
  await setSlider(page, "Target Size", 2.4);
  const grown = await oar(page);
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");

  await page.reload();
  await expect(stat(page, "stat-oar")).toHaveText(String(grown.toFixed(1)));

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await page2.goto(url);
  await expect(stat(page2, "stat-oar")).toHaveText(String(grown.toFixed(1)));
  await other.close();
});

test("dragging a controller handle on the canvas moves the field", async ({ page }) => {
  await enableFields(page);
  await addController(page, "point");
  const centred = await oar(page);

  // The controller starts at the middle of the sheet, which is the middle of the
  // canvas at zoom 1. Drag it right off the corner, so most of its reach now
  // falls outside the panel and the open area drops. (A shorter drag would not
  // prove much: a round bump that stays wholly on the sheet adds the same area
  // wherever it sits.)
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 380, box.y + box.height / 2 - 380, { steps: 10 });
  await page.mouse.up();
  const moved = await oar(page);
  expect(moved).toBeLessThan(centred - 0.5);

  // And the whole drag collapsed into one undo step.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  expect(await oar(page)).toBeCloseTo(centred, 1);
});

test("the superellipse hole morphs from diamond to square, and exports as one", async ({ page }) => {
  await choose(page, "Hole Shape", "Superellipse");
  await expect(page.getByLabel("Shape Mix", { exact: true })).toHaveValue("0.5");
  const ellipse = await oar(page);

  await setSlider(page, "Shape Mix", 0);
  const diamond = await oar(page);
  await setSlider(page, "Shape Mix", 1);
  const square = await oar(page);
  expect(diamond).toBeLessThan(ellipse);
  expect(square).toBeGreaterThan(ellipse);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('width="200mm" height="200mm"');
  expect(svg.match(/<polygon /g).length).toBe(739);
});

test("a shape controller morphs only the holes it reaches", async ({ page }) => {
  await choose(page, "Hole Shape", "Superellipse");
  const flat = await oar(page);
  await enableFields(page);
  await page.getByRole("button", { name: "Shape channel", exact: true }).first().click();
  await addController(page, "point");
  // Squarer holes in the middle, the document's own mix everywhere else.
  expect(await oar(page)).toBeGreaterThan(flat);
  await expect(stat(page, "stat-holes")).toHaveText("739");
});

test("an angle controller turns the holes it reaches", async ({ page }) => {
  await choose(page, "Hole Shape", "Rectangle");
  await choose(page, "Type", "Straight");
  await setSlider(page, "Width (W)", 9);
  await setSlider(page, "Height (H)", 3);
  const straight = await stat(page, "stat-ligament").textContent();
  const holes = await stat(page, "stat-holes").textContent();

  await enableFields(page);
  await page.getByRole("button", { name: "Angle channel", exact: true }).first().click();
  await addController(page, "point");
  // Turning long rectangles on their side changes what the narrowest bridge is,
  // and turning them never adds or drops one.
  await expect(stat(page, "stat-ligament")).not.toHaveText(straight);
  await expect(stat(page, "stat-holes")).toHaveText(holes);

  // Zero degrees is the neutral value, so the field stops mattering.
  await setSlider(page, "Target Angle", 0);
  await expect(stat(page, "stat-ligament")).toHaveText(straight);
});

test("an image controller drives the channel from the picture's brightness", async ({ page }) => {
  await enableFields(page);
  await addController(page, "image");
  const inert = await oar(page);
  // No picture yet: the controller is inert rather than reading as black.
  expect(inert).toBeCloseTo(35.4, 1);

  // A 2×1 PNG, black beside white. Written by the browser so the test does not
  // carry a binary fixture around.
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(1, 0, 1, 1);
    return canvas.toDataURL("image/png");
  });
  const bytes = Buffer.from(png.split(",")[1], "base64");
  await page
    .getByLabel("Controller image", { exact: true })
    .setInputFiles({ name: "split.png", mimeType: "image/png", buffer: bytes });

  await expect(page.getByText(/split\.png · 2×1/)).toBeVisible();
  // The white half now grows its holes, so the open area is up.
  await expect.poll(() => oar(page)).toBeGreaterThan(inert + 0.5);
  const bright = await oar(page);

  // Inverting swaps which half of the picture grows its holes. The sheet is
  // symmetric under that swap, so the figure lands in the same place — what it
  // proves is that the transfer curve is applied at all rather than skipped.
  await page.getByRole("switch", { name: "Invert image", exact: true }).click();
  expect(await oar(page)).toBeCloseTo(bright, 1);

  // A target equal to the channel's neutral value is the pattern's own geometry,
  // reported on the counted path (a live controller always is — which is why
  // this, and not the theoretical 35.4 above, is what a flattened image matches).
  await setSlider(page, "Target Size", 1);
  const neutral = await oar(page);
  expect(neutral).toBeLessThan(bright);
  await setSlider(page, "Target Size", 1.8);
  expect(await oar(page)).toBeCloseTo(bright, 1);

  // Flattening the output range sends every pixel to that same neutral value, so
  // the picture stops driving anything without being detached.
  await setSlider(page, "Level Max", 0);
  await expect.poll(() => oar(page)).toBeCloseTo(neutral, 1);
  await setSlider(page, "Level Max", 100);
  await page.getByRole("switch", { name: "Invert image", exact: true }).click();

  // The picture is saved with the document…
  await page.reload();
  await expect(page.getByText(/split\.png · 2×1/)).toBeVisible();
  await expect.poll(() => oar(page)).toBeGreaterThan(inert);

  // …and dropped from a share link, where the controller goes inert instead.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await expect(page.getByText(/leave out the controller images/)).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const page2 = await (await page.context().browser().newContext()).newPage();
  await page2.goto(url);
  expect(await oar(page2)).toBeCloseTo(bright - (bright - inert), 1);
  await page2.context().close();
});

test("removing a controller drops its image, and the cap holds", async ({ page }) => {
  await enableFields(page);
  for (let i = 0; i < 10; i++) {
    const button = page.getByRole("button", { name: "Add point controller", exact: true }).first();
    if (await button.isDisabled()) break;
    await button.click();
  }
  // Eight is the cap, and the button says so rather than silently doing nothing.
  await expect(page.getByText("Add (8/8)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add point controller", exact: true }).first()).toBeDisabled();

  await page.getByRole("button", { name: "Remove every controller", exact: true }).click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
});
