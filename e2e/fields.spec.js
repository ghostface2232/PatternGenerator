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

// Every control below is addressed by an accessible name that is unique in the
// document — no `.first()` — so a future duplicate fails loudly here instead of
// silently picking one of two different buttons.
const addController = async (page, kind) => {
  const button = page.getByRole("button", { name: `Add ${kind} controller`, exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.click();
};

const chooseChannel = (page, label) =>
  page.getByRole("button", { name: `${label} field channel`, exact: true }).click();

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
  const grown = await oar(page);

  // Measured against a controller aimed at the channel's own neutral value, NOT
  // against the 35.4 above: a live controller switches the statistics onto the
  // counted path, which reads 35.6 for the very same geometry. Comparing with
  // the theoretical figure would pass even if the size channel did nothing.
  await setSlider(page, "Target Size", 1);
  const neutral = await oar(page);
  expect(grown).toBeGreaterThan(neutral + 1);
  // And a neutral controller is not treated as live at all, so the headline
  // figure does not move when nothing about the pattern has.
  await expect(stat(page, "stat-oar")).toHaveText("35.4");

  await setSlider(page, "Target Size", 1.4);
  expect(await oar(page)).toBeCloseTo(grown, 1);

  // Turning the block off puts the theoretical figure back, exactly.
  const toggle = page.getByRole("switch", { name: "Field Controllers", exact: true });
  await toggle.click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
  await toggle.click();
  expect(await oar(page)).toBeCloseTo(grown, 1);

  // The reach is what decides how much of the sheet it touches.
  await setSlider(page, "Reach", 10);
  const narrow = await oar(page);
  expect(narrow).toBeLessThan(grown);
  expect(narrow).toBeGreaterThan(neutral);
});

test("a controller is one undo step, and its drag is another", async ({ page }) => {
  await enableFields(page);
  await addController(page, "point");
  const grown = await oar(page);
  await setSlider(page, "Target Size", 2.5);
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
  await chooseChannel(page, "Shape");
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
  await chooseChannel(page, "Angle");
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

  // A 4×1 PNG: three dark cells and one bright one. Written by the browser so
  // the test carries no binary fixture. Deliberately NOT left-right symmetric —
  // a symmetric picture reads the same inverted, because the sheet is symmetric
  // too, and the invert assertion below would then pass on a no-op.
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 3, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(3, 0, 1, 1);
    return canvas.toDataURL("image/png");
  });
  const bytes = Buffer.from(png.split(",")[1], "base64");
  await page
    .getByLabel("Controller image", { exact: true })
    .setInputFiles({ name: "split.png", mimeType: "image/png", buffer: bytes });

  await expect(page.getByText(/split\.png · 4×1/)).toBeVisible();
  // The white half now grows its holes, so the open area is up.
  await expect.poll(() => oar(page)).toBeGreaterThan(inert + 0.5);
  const bright = await oar(page);

  // Inverting swaps which cells grow: one quarter of the picture is bright, so
  // three quarters are after the swap, and the open area has to jump.
  await page.getByRole("switch", { name: "Invert image", exact: true }).click();
  await expect.poll(() => oar(page)).toBeGreaterThan(bright + 1);
  await page.getByRole("switch", { name: "Invert image", exact: true }).click();
  await expect.poll(() => oar(page)).toBeCloseTo(bright, 1);

  // A fresh picture is read as a halftone whose two ends are the value at
  // black and at white; with both on the channel's neutral value the pattern
  // is left alone.
  const defaultTarget = await page.getByLabel("Light → Size", { exact: true }).inputValue();
  await expect(page.getByLabel("Dark → Size", { exact: true })).toHaveValue("1");
  await setSlider(page, "Light → Size", 1);
  expect(await oar(page)).toBeLessThan(bright);
  await expect(stat(page, "stat-ligament")).toHaveText("3.00 mm");
  await setSlider(page, "Light → Size", defaultTarget);
  expect(await oar(page)).toBeCloseTo(bright, 1);

  // Flattening the output range sends every pixel to zero brightness, so the
  // picture stops driving anything without being detached. Read off the
  // ligament rather than the open area: with a picture attached the statistics
  // are on the counted path either way, and the counted and theoretical figures
  // differ slightly for identical geometry (35.6 against 35.4), so the OAR alone
  // cannot say whether the geometry moved.
  await expect(stat(page, "stat-ligament")).not.toHaveText("3.00 mm");
  await setSlider(page, "Level Max", 0);
  await expect(stat(page, "stat-ligament")).toHaveText("3.00 mm");
  await setSlider(page, "Level Max", 100);
  await expect(stat(page, "stat-ligament")).not.toHaveText("3.00 mm");

  // The picture is saved with the document…
  await page.reload();
  await expect(page.getByText(/split\.png · 4×1/)).toBeVisible();
  await expect.poll(() => oar(page)).toBeGreaterThan(inert);

  // …and dropped from a share link, where the controller goes inert instead.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await expect(page.getByText(/leave out the controller images/)).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const page2 = await (await page.context().browser().newContext()).newPage();
  await page2.goto(url);
  expect(await oar(page2)).toBeCloseTo(inert, 1);
  await page2.context().close();
});

test("the controller cap holds, and clearing puts the pattern back", async ({ page }) => {
  await enableFields(page);
  for (let i = 0; i < 10; i++) {
    const button = page.getByRole("button", { name: "Add point controller", exact: true });
    if (await button.isDisabled()) break;
    await button.click();
  }
  // Eight is the cap, and the button says so rather than silently doing nothing.
  await expect(page.getByText("Add (8/8)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add point controller", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Remove every field controller", exact: true }).click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");
});

test("the three canvas modes are mutually exclusive", async ({ page }) => {
  // Two at once means a click does something the badge does not describe: with
  // field editing and hole removal both live, a click that missed a controller
  // silently deleted a hole.
  await enableFields(page);
  await addController(page, "point");
  await expect(page.getByText(/SIZE FIELD/)).toBeVisible();

  const removal = page.getByRole("switch", { name: "Click to Remove", exact: true });
  await removal.scrollIntoViewIfNeeded();
  await removal.click();
  await expect(page.getByText(/HOLE REMOVAL MODE/)).toBeVisible();
  await expect(page.getByText(/SIZE FIELD/)).toHaveCount(0);

  const editFields = page.getByRole("button", { name: "Edit field controllers on the canvas", exact: true });
  await editFields.scrollIntoViewIfNeeded();
  await editFields.click();
  await expect(page.getByText(/SIZE FIELD/)).toBeVisible();
  await expect(page.getByText(/HOLE REMOVAL MODE/)).toHaveCount(0);

  const editVariation = page.getByRole("button", { name: "Edit the size gradient on the canvas", exact: true });
  await editVariation.scrollIntoViewIfNeeded();
  await editVariation.click();
  await expect(page.getByText(/EDIT VARIATION/)).toBeVisible();
  await expect(page.getByText(/SIZE FIELD/)).toHaveCount(0);
});

test("a line drawn on the canvas becomes a line controller", async ({ page }) => {
  await enableFields(page);
  await addController(page, "point");
  await page.getByRole("button", { name: "Remove every field controller", exact: true }).click();
  await expect(stat(page, "stat-oar")).toHaveText("35.4");

  // Arming the line tool says to drag, not to click — clicking used to drop a
  // point while the badge promised a line.
  await page.getByRole("button", { name: "Draw line controller on the canvas", exact: true }).click();
  await expect(page.getByText(/DRAG TO PLACE LINE/)).toBeVisible();

  const box = await page.locator("canvas").boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx - 150, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Select size line controller 1", exact: true })).toBeVisible();
  expect(await oar(page)).toBeGreaterThan(35.6);

  // Escape puts the tool away without leaving edit mode.
  await page.keyboard.press("Escape");
  await expect(page.getByText(/SIZE FIELD/)).toBeVisible();
});

test("dropping an image anywhere on the page feeds a controller", async ({ page }) => {
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
  await page.evaluate(async dataURL => {
    const blob = await (await fetch(dataURL)).blob();
    const file = new File([blob], "drop.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, png);

  // A new image controller appears, already holding the picture.
  await expect(page.getByText(/drop\.png · 2×1/)).toBeVisible();
  await expect.poll(() => oar(page)).toBeGreaterThan(35.6);
});
