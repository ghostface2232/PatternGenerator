import { test, expect } from "@playwright/test";
import LZString from "lz-string";

// Persistence, sharing and undo/redo (Phase 1).

async function setSlider(page, label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

const stat = (page, id) => page.getByTestId(id);

// Drive a slider from inside the page: find the range input by the label on its
// numeric field rather than by position, which a sidebar reorder would break.
const SET_SLIDER = `(label, value) => {
  const field = document.querySelector('input[aria-label="' + label + '"]');
  let row = field;
  while (row && !row.querySelector('input[type="range"]')) row = row.parentElement;
  const slider = row.querySelector('input[type="range"]');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setValue.call(slider, String(value));
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}`;

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

test("an unload flushes edits the debounce has not written yet", async ({ page }) => {
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  // Drive the slider and the unload in one task so the 300 ms debounce cannot
  // fire in between: whatever lands in storage got there through the flush.
  const saved = await page.evaluate(setSlider => {
    eval(setSlider)("Hole Diameter", 7);
    window.dispatchEvent(new Event("pagehide"));
    return JSON.parse(localStorage.getItem("perf-pattern:current")).hole.diameter;
  }, SET_SLIDER);
  expect(saved).toBe(7);
});

test("an untouched tab never overwrites what another tab saved", async ({ page }) => {
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  const name = await page.evaluate(() => {
    const other = JSON.parse(localStorage.getItem("perf-pattern:current"));
    other.name = "Saved by another tab";
    localStorage.setItem("perf-pattern:current", JSON.stringify(other));
    document.dispatchEvent(new Event("visibilitychange")); // this tab is still visible
    window.dispatchEvent(new Event("pagehide")); // and has nothing of its own to save
    return JSON.parse(localStorage.getItem("perf-pattern:current")).name;
  });
  expect(name).toBe("Saved by another tab");
});

test("a visibility change while the tab is still visible leaves the write to the debounce", async ({ page }) => {
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  const [afterVisible, afterHide] = await page.evaluate(setSlider => {
    eval(setSlider)("Hole Diameter", 9); // unsaved, debounce armed
    const other = JSON.parse(localStorage.getItem("perf-pattern:current"));
    other.name = "Written elsewhere";
    localStorage.setItem("perf-pattern:current", JSON.stringify(other));
    document.dispatchEvent(new Event("visibilitychange")); // visibilityState is still "visible"
    const stillThere = JSON.parse(localStorage.getItem("perf-pattern:current")).name;
    window.dispatchEvent(new Event("pagehide")); // now the page really is going away
    return [stillThere, JSON.parse(localStorage.getItem("perf-pattern:current")).hole.diameter];
  }, SET_SLIDER);
  expect(afterVisible).toBe("Written elsewhere");
  expect(afterHide).toBe(9);
});

test("a flush disarms the debounce instead of writing again behind it", async ({ page }) => {
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  await page.evaluate(setSlider => {
    eval(setSlider)("Hole Diameter", 7);
    window.dispatchEvent(new Event("pagehide")); // the flush writes it
    const other = JSON.parse(localStorage.getItem("perf-pattern:current"));
    other.name = "Saved by another tab";
    localStorage.setItem("perf-pattern:current", JSON.stringify(other));
  }, SET_SLIDER);
  // The debounce armed by that edit is still pending. It must find nothing left
  // to write; otherwise it lands here and overwrites the other tab's save.
  await page.waitForTimeout(700);
  const name = await page.evaluate(() => JSON.parse(localStorage.getItem("perf-pattern:current")).name);
  expect(name).toBe("Saved by another tab");
});

test("a recent-list failure does not leave the tab rewriting on every hide", async ({ page }) => {
  // The document itself saves; only the (much larger) recent list hits the quota.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "perf-pattern:recent") throw new DOMException("quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  const name = await page.evaluate(() => {
    const other = JSON.parse(localStorage.getItem("perf-pattern:current"));
    other.name = "Saved by another tab";
    localStorage.setItem("perf-pattern:current", JSON.stringify(other));
    window.dispatchEvent(new Event("pagehide"));
    return JSON.parse(localStorage.getItem("perf-pattern:current")).name;
  });
  expect(name).toBe("Saved by another tab");
});

test("a failed write reports NOT SAVED instead of hanging on SAVING", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "perf-pattern:current") throw new DOMException("quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await setSlider(page, "Hole Diameter", 6);
  await expect(stat(page, "save-status")).toHaveText("NOT SAVED");
  await expect(stat(page, "stat-holes")).toBeVisible(); // and the app keeps working
});

// Remove exactly one hole by clicking the canvas. Steps of 25 px are wider than
// the 3.75 mm hit radius at this zoom, so a click that misses is followed by one
// aimed at a different hole rather than one that toggles the same hole back on.
async function removeOneHole(page) {
  const before = Number(await stat(page, "stat-holes").textContent());
  await page.getByRole("switch", { name: "Click to Remove" }).click();
  const box = await page.locator("canvas").boundingBox();
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  for (const [dx, dy] of [
    [0, 0],
    [25, 0],
    [0, 25],
    [25, 25],
    [50, 25],
  ]) {
    await page.mouse.click(centreX + dx, centreY + dy);
    const removed = await expect(stat(page, "stat-holes"))
      .toHaveText(String(before - 1), { timeout: 500 })
      .then(
        () => true,
        () => false
      );
    if (removed) break;
  }
  await expect(stat(page, "stat-holes")).toHaveText(String(before - 1));
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeVisible();
  await page.getByRole("switch", { name: "Click to Remove" }).click();
}

test("removed holes survive a reload", async ({ page }) => {
  await removeOneHole(page);
  const remaining = await stat(page, "stat-holes").textContent();
  expect(Number(remaining)).toBeLessThan(739);
  await expect(stat(page, "save-status")).toHaveText("SAVED IN BROWSER");
  await page.reload();
  await expect(stat(page, "stat-holes")).toHaveText(remaining);
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeVisible();
});

test("a link toggle keeps removed holes; a pattern edit clears them and undo restores both", async ({ page }) => {
  await removeOneHole(page);
  const remaining = await stat(page, "stat-holes").textContent();

  // Toggling the margin link changes no hole position, so the removal stands.
  await page.getByTitle("Set per-side margins").click();
  await expect(stat(page, "stat-holes")).toHaveText(remaining);

  // Changing the diameter regenerates the pattern, so stale indices are dropped.
  await setSlider(page, "Hole Diameter", 4);
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeHidden();

  // That clearing rode along in the same undo step.
  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("5");
  await expect(stat(page, "stat-holes")).toHaveText(remaining);
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeVisible();
});

test("reshaping a hole keeps removals: corner radius and taper never move one", async ({ page }) => {
  await page.getByRole("button", { name: "Hole Shape", exact: true }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await removeOneHole(page);
  const remaining = await stat(page, "stat-holes").textContent();

  await setSlider(page, "Hole Corner R", 1);
  await expect(stat(page, "stat-holes")).toHaveText(remaining);
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeVisible();

  await page.getByRole("switch", { name: "Sheet Thickness & Hole Taper" }).click();
  await setSlider(page, "Thickness (t)", 2);
  await setSlider(page, "Taper Angle (θ)", 8);
  await expect(stat(page, "stat-holes")).toHaveText(remaining);
  await expect(page.getByRole("button", { name: "Restore All Holes" })).toBeVisible();
});

test("removals from another pattern read consistently and can still be cleared", async ({ browser }) => {
  // A document whose removals index a pattern it no longer describes: nothing is
  // actually removed, and the badge, the panel and the count must all say so —
  // while the way to clear the leftovers stays reachable.
  const stale = {
    schemaVersion: 1,
    name: "Stale",
    sheet: { w: 200, h: 200 },
    hole: { shape: "Circle" },
    removedHoles: [900001, 900002, 900003],
  };
  const { context, page } = await coldStart(browser, "/", stale);
  await expect(stat(page, "stat-holes")).toHaveText("739");
  await page.getByRole("switch", { name: "Click to Remove" }).click();
  await expect(page.getByText("HOLE REMOVAL MODE", { exact: false })).toHaveText("HOLE REMOVAL MODE");
  await expect(page.getByText("From another pattern")).toBeVisible();
  await page.getByRole("button", { name: "Restore All Holes" }).click();
  await expect(page.getByText("From another pattern")).toBeHidden();
  await expect(stat(page, "stat-holes")).toHaveText("739");
  await context.close();
});

test("a dropped file never navigates the tab away, and a document file opens", async ({ page }) => {
  let dismissed = null;
  page.on("dialog", d => {
    dismissed = d.message();
    d.dismiss();
  });
  const prevented = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
    const ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(dismissed).toBe(`Not a Perf Pattern document: drop a .perf.json file to open it.`);
  await expect(stat(page, "doc-name")).toHaveText("Untitled");

  await page.evaluate(() => {
    const doc = {
      schemaVersion: 1,
      name: "Dropped in",
      sheet: { w: 150, h: 150 },
      hole: { shape: "Circle", diameter: 5 },
    };
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(doc)], "dropped.perf.json", { type: "application/json" }));
    window.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await expect(stat(page, "doc-name")).toHaveText("Dropped in");
  await expect(page.getByLabel("Panel Width", { exact: true })).toHaveValue("150");
});

// A document whose types are all wrong but whose shape passes the "is this even
// a document?" guard, so it reaches validateDocument rather than being rejected
// outright. Without validation the render throws on variation.layers.find and
// on rendering an object as the document name, and the app comes up blank.
const CORRUPT_DOCUMENT = {
  schemaVersion: 1,
  name: { not: "a string" },
  units: "furlongs",
  sheet: { w: "abc", h: null },
  hole: { shape: "Blob", diameter: "7", cornerRadius: 1e9 },
  layout: { type: 42, edgeGapX: -5, radial: { mode: "Nope" } },
  variation: { layers: null, selectedLayerId: "ghost", minScale: 9, maxScale: 0.1 },
  taper: { enabled: "yes", direction: "Sideways" },
  appearance: { holeColor: "red", bgColor: "#00FF00" },
  removedHoles: "nope",
};

// A link click or a cold start, not a hash change inside a page that is already
// running: same-document navigation would never re-read the URL.
async function coldStart(browser, url, seed) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (seed) {
    await page.addInitScript(doc => localStorage.setItem("perf-pattern:current", JSON.stringify(doc)), seed);
  }
  await page.goto(url);
  return { context, page };
}

async function expectRepaired(page) {
  await expect(stat(page, "doc-name")).toHaveText("Untitled");
  await expect(page.getByRole("button", { name: "Hole Shape", exact: true })).toHaveText("Circle");
  await expect(page.getByLabel("Hole Diameter", { exact: true })).toHaveValue("7"); // numeric string kept
  await expect(page.getByLabel("Panel Width", { exact: true })).toHaveValue("200"); // "abc" → default
  await expect(page.getByLabel("X Edge Gap", { exact: true })).toHaveValue("0"); // -5 clamped
  await expect(stat(page, "stat-holes")).not.toHaveText("0");
}

test("a corrupt autosave is repaired rather than blanking the app", async ({ browser }) => {
  const { context, page } = await coldStart(browser, "/", CORRUPT_DOCUMENT);
  await expectRepaired(page);
  await context.close();
});

test("a corrupt share link is repaired rather than blanking the app", async ({ browser }) => {
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(CORRUPT_DOCUMENT));
  const { context, page } = await coldStart(browser, `/#d=${payload}`);
  await expectRepaired(page);
  expect(page.url()).not.toContain("#d=");
  await context.close();
});

test("an undecodable share link falls back to the autosaved document", async ({ browser }) => {
  const autosaved = { schemaVersion: 1, name: "Autosaved", sheet: { w: 150, h: 150 }, hole: { shape: "Circle" } };
  const { context, page } = await coldStart(browser, "/#d=not-a-real-payload", autosaved);
  await expect(stat(page, "doc-name")).toHaveText("Autosaved");
  await expect(page.getByLabel("Panel Width", { exact: true })).toHaveValue("150");
  await context.close();
});
