import { expect } from "@playwright/test";

// The inspector shows one page at a time — the one the rail has open — so a
// control has to be reached through its page. Opening a page enters the canvas
// mode it owns when that costs no document edit (Remove always; Boundary once
// there is an outline or a cutout to drag; Fields once its block or the gradient
// is on; Path once a curve exists), and leaves whatever mode another page had.
export const PAGES = {
  project: "Project panel",
  pattern: "Pattern panel",
  boundary: "Boundary panel",
  fields: "Fields panel",
  path: "Path panel",
  remove: "Remove holes panel",
  taper: "Taper panel",
  export: "Export panel",
};

// Idempotent: the rail's click on the page already open toggles its canvas
// mode, which is not what "make sure this page is showing" means.
export async function goTo(page, id) {
  const button = page.getByRole("button", { name: PAGES[id], exact: true });
  if ((await button.getAttribute("aria-pressed")) === "true") return;
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
