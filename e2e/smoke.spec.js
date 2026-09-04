import { test, expect } from "@playwright/test";

// Baseline numbers for the default document (Circle ⌀5, Staggered 60°, gap 3,
// 200×200 sheet). They pin the generator's output so refactors that change
// geometry are caught immediately.
const BASELINE = { holes: "739", oar: "35.4", ligament: "3.00 mm" };

async function setSlider(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

async function choose(page, dropdownLabel, optionLabel) {
  await page.getByRole("button", { name: dropdownLabel, exact: true }).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
}

const stat = (page, id) => page.getByTestId(id);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(stat(page, "stat-holes")).toBeVisible();
});

test("default document matches the baseline", async ({ page }) => {
  await expect(stat(page, "stat-holes")).toHaveText(BASELINE.holes);
  await expect(stat(page, "stat-oar")).toHaveText(BASELINE.oar);
  await expect(stat(page, "stat-ligament")).toHaveText(BASELINE.ligament);
});

test("min ligament follows the edge gap", async ({ page }) => {
  await setSlider(page, "X Edge Gap", 4.5);
  await expect(stat(page, "stat-ligament")).toHaveText("4.50 mm");
  await setSlider(page, "Hole Diameter", 3);
  await expect(stat(page, "stat-ligament")).toHaveText("4.50 mm");
});

test("seamless tilings reach 100% open area at gap 0", async ({ page }) => {
  // Hexagon honeycomb
  await choose(page, "Hole Shape", "Hexagon");
  await setSlider(page, "Edge Gap (all sides)", 0);
  await expect(stat(page, "stat-oar")).toHaveText("100.0");
  await expect(stat(page, "stat-ligament")).toHaveText("0.00 mm");

  // Diamond rhombus lattice (still Staggered 60°)
  await choose(page, "Hole Shape", "Diamond");
  await setSlider(page, "Edge Gap (all sides)", 0);
  await expect(stat(page, "stat-oar")).toHaveText("100.0");

  // Triangle alternating rows (any grid type)
  await choose(page, "Hole Shape", "Triangle");
  await choose(page, "Type", "Straight");
  await setSlider(page, "Edge Gap (all sides)", 0);
  await expect(stat(page, "stat-oar")).toHaveText("100.0");

  // A non-zero gap becomes the uniform ligament
  await setSlider(page, "Edge Gap (all sides)", 1.5);
  await expect(stat(page, "stat-ligament")).toHaveText("1.50 mm");
});

test("DIN preset applies diameter, gap and pattern", async ({ page }) => {
  await choose(page, "Preset (DIN 24041)", "Rv 3-5 (60° staggered)");
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("X Edge Gap", { exact: true })).toHaveValue("2");
  await expect(stat(page, "stat-oar")).toHaveText("32.6");
});

test("radial pattern renders and reports counted OAR", async ({ page }) => {
  await choose(page, "Type", "Radial");
  await expect(stat(page, "stat-holes")).not.toHaveText("0");
  const oar = parseFloat(await stat(page, "stat-oar").textContent());
  expect(oar).toBeGreaterThan(10);
  expect(oar).toBeLessThan(60);
});

test("SVG export contains one element per hole in mm units", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('width="200mm" height="200mm"');
  expect(svg.match(/<circle /g)).toHaveLength(Number(BASELINE.holes));
});
