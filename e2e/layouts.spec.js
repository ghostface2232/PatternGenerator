import { test, expect } from "@playwright/test";

// The Phase 3 layout modes and the spacing field channel, in a real browser.
// Every control is addressed by an accessible name that is unique in the
// document — no `.first()` — so a future duplicate fails loudly here.

const stat = (page, id) => page.getByTestId(id);
const holes = page => stat(page, "stat-holes").textContent().then(t => Number(t.replace(/[^\d]/g, ""))); // prettier-ignore
const ligament = page => stat(page, "stat-ligament").textContent().then(parseFloat);

async function choose(page, dropdownLabel, optionLabel) {
  await page.getByRole("button", { name: dropdownLabel, exact: true }).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
}

async function setSlider(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.scrollIntoViewIfNeeded();
  await input.fill(String(value));
  await input.press("Enter");
}

async function enableFields(page) {
  const toggle = page.getByRole("switch", { name: "Field Controllers", exact: true });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

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

for (const type of ["Cross-hatch", "Scatter", "Spiral", "Fibonacci"]) {
  test(`${type} draws a pattern and exports it`, async ({ page }) => {
    await choose(page, "Type", type);
    const count = await holes(page);
    expect(count).toBeGreaterThan(100);
    const oar = parseFloat(await stat(page, "stat-oar").textContent());
    expect(oar).toBeGreaterThan(5);
    expect(oar).toBeLessThan(100);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG", exact: true }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const svg = Buffer.concat(chunks).toString("utf8");
    expect(svg).toContain('width="200mm" height="200mm"');
    expect(svg.match(/<circle /g)).toHaveLength(count);
  });
}

test("cross-hatch is the straight grid at right angles and empties when parallel", async ({ page }) => {
  await choose(page, "Type", "Straight");
  const straight = await holes(page);

  await choose(page, "Type", "Cross-hatch");
  await setSlider(page, "Line Angle A", 90);
  await setSlider(page, "Line Angle B", 0);
  expect(await holes(page)).toBe(straight);

  // Turning one family toward the other spreads the lattice cell, so the count falls.
  await setSlider(page, "Line Angle B", 60);
  expect(await holes(page)).toBeLessThan(straight);

  // Near-parallel cuts no usable lattice: the mode says so instead of hanging.
  await setSlider(page, "Line Angle B", 89);
  await expect(page.getByText(/cut no usable lattice/)).toBeVisible();
  expect(await holes(page)).toBe(0);
});

test("the scatter seed shuffles the arrangement but never the minimum gap", async ({ page }) => {
  await choose(page, "Type", "Scatter");
  await expect(page.getByLabel("Scatter Seed", { exact: true })).toHaveValue("1");
  const first = await holes(page);
  // No two centres closer than the hole plus the gap, whatever the seed.
  expect(await ligament(page)).toBeGreaterThanOrEqual(3);

  await page.getByRole("button", { name: "Shuffle the scatter seed", exact: true }).click();
  await expect(page.getByLabel("Scatter Seed", { exact: true })).not.toHaveValue("1");
  expect(await ligament(page)).toBeGreaterThanOrEqual(3);
  // Same density, different arrangement.
  expect(Math.abs((await holes(page)) - first)).toBeLessThan(first * 0.2);

  // And it is one undo step, so the arrangement can be got back.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(page.getByLabel("Scatter Seed", { exact: true })).toHaveValue("1");
  expect(await holes(page)).toBe(first);
});

test("a spacing controller thins a scatter, and survives a reload", async ({ page }) => {
  await choose(page, "Type", "Scatter");
  const base = await holes(page);

  await enableFields(page);
  await chooseChannel(page, "Spacing");
  await addController(page, "point");
  await setSlider(page, "Target Spacing", 2.5);
  const thinned = await holes(page);
  expect(thinned).toBeLessThan(base);

  // A picture cannot decide where a hole goes, so the tool is not offered here.
  await expect(page.getByRole("button", { name: "Add image controller", exact: true })).toHaveCount(0);

  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  await page.reload();
  await expect(stat(page, "stat-holes")).toHaveText(String(thinned));
});

test("a spacing controller stretches the grid rows and keeps the columns straight", async ({ page }) => {
  await choose(page, "Type", "Straight");
  const base = await holes(page);
  await enableFields(page);
  await chooseChannel(page, "Spacing");
  await addController(page, "point");

  await setSlider(page, "Target Spacing", 2.5);
  expect(await holes(page)).toBeLessThan(base);
  await setSlider(page, "Target Spacing", 0.6);
  expect(await holes(page)).toBeGreaterThan(base);

  // The channel's neutral value is 1×, and a controller sitting on it leaves the
  // pattern exactly where it was — including on the theoretical open-area path,
  // which reads a different figure for the very same geometry.
  await setSlider(page, "Target Spacing", 1);
  expect(await holes(page)).toBe(base);
  await expect(stat(page, "stat-oar")).toHaveText("30.7");
});

test("the modes that ignore the spacing channel say why", async ({ page }) => {
  await enableFields(page);
  await chooseChannel(page, "Spacing");
  // The default document is a honeycomb-free circle grid, so the channel is live.
  await expect(page.getByText(/exact interlocking tiling/)).toHaveCount(0);

  await choose(page, "Hole Shape", "Hexagon");
  await expect(page.getByText(/exact interlocking tiling/)).toBeVisible();

  await choose(page, "Hole Shape", "Circle");
  await choose(page, "Type", "Radial");
  await expect(page.getByText(/no pitch for a spacing field to scale/)).toBeVisible();

  // And a controller they ignore leaves the pattern untouched.
  await addController(page, "point");
  const withController = await holes(page);
  await page.getByRole("button", { name: "Remove every field controller", exact: true }).click();
  expect(await holes(page)).toBe(withController);
});
