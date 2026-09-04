import { defineConfig } from "@playwright/test";

// Browser smoke tests run against the Vite dev server (source, not the committed
// docs/ build). The pre-installed Chromium is used when PLAYWRIGHT_CHROMIUM_PATH
// is set (e.g. in the remote sandbox); otherwise Playwright's own download.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 1400, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
