import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const TARGET_ROUTES = [
  { name: "Home Page", path: "/" },
  { name: "Dashboard", path: "/dashboard" },
  { name: "Learning Path", path: "/learning-path" },
  { name: "Challenges", path: "/challenges" },
  { name: "Contributor Sandbox", path: "/contributor-sandbox" },
  { name: "Community", path: "/community" },
  { name: "Leaderboard", path: "/leaderboard" },
  { name: "Chat", path: "/chat" },
];

test.describe("WCAG 2.2 AA Compliance Audit (axe-core CI)", () => {
  for (const route of TARGET_ROUTES) {
    test(`Route '${route.path}' (${route.name}) should meet WCAG 2.2 AA standards with zero violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();

      if (accessibilityScanResults.violations.length > 0) {
        console.log(
          `[a11y-ci] ${accessibilityScanResults.violations.length} accessibility violation(s) found on ${route.path}:`,
        );
        accessibilityScanResults.violations.forEach((v) => {
          console.log(`  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.help}`);
          console.log(`    Help URL: ${v.helpUrl}`);
          v.nodes.forEach((node) => {
            console.log(`    Selector: ${node.target.join(", ")}`);
          });
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
