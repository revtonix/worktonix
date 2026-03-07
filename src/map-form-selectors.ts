import { chromium, Browser, Page } from "playwright";
import axios from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const ADSPOWER_API = "http://local.adspower.net:50325";
const PROFILE_ID = process.env.ADSPOWER_PROFILE_ID || "k1a7qgw8";
const API_KEY =
  process.env.ADSPOWER_API_KEY ||
  "32bd8fc3024d3de11ddb5efcb7fe2f5500781143a9666f96";
const TARGET_URL = "https://www.unitedemergencyrelief.com/";

interface FieldInfo {
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  value: string;
  options?: string[];
  labels?: string[];
  classes: string;
  visible: boolean;
  dataAttrs?: Record<string, string>;
}

interface ClickableOption {
  text: string;
  tag: string;
  classes: string;
  dataValue: string;
  name: string;
  parentText: string;
}

interface StepData {
  step: number;
  url: string;
  title: string;
  fields: FieldInfo[];
  clickableOptions: ClickableOption[];
  heading: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectAdsPower(): Promise<string> {
  console.log("Starting AdsPower browser for profile: " + PROFILE_ID);

  const response = await axios.get(ADSPOWER_API + "/api/v1/browser/start", {
    params: { user_id: PROFILE_ID, api_key: API_KEY },
  });

  const data = response.data;
  if (data.code !== 0) {
    throw new Error("AdsPower API error: " + data.msg);
  }

  const wsUrl: string = data.data.ws?.puppeteer || data.data.ws;
  if (!wsUrl) {
    throw new Error("No websocket URL returned from AdsPower");
  }

  console.log("Got WebSocket endpoint: " + wsUrl);
  return wsUrl;
}

async function extractFields(page: Page): Promise<FieldInfo[]> {
  return await page.evaluate(() => {
    const fields: any[] = [];
    const seen = new Set<Element>();

    function getLabels(el: Element): string[] {
      const labels: string[] = [];
      const id = el.getAttribute("id");
      if (id) {
        const label = document.querySelector('label[for="' + id + '"]');
        if (label) labels.push(label.textContent?.trim() || "");
      }
      const parentLabel = el.closest("label");
      if (parentLabel) labels.push(parentLabel.textContent?.trim() || "");
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) labels.push(ariaLabel);
      const ariaLabelledBy = el.getAttribute("aria-labelledby");
      if (ariaLabelledBy) {
        const labelEl = document.getElementById(ariaLabelledBy);
        if (labelEl) labels.push(labelEl.textContent?.trim() || "");
      }
      const prev = el.previousElementSibling;
      if (
        prev &&
        (prev.tagName === "LABEL" ||
          prev.tagName === "SPAN" ||
          prev.tagName === "P")
      ) {
        const t = prev.textContent?.trim();
        if (t && t.length < 60) labels.push(t);
      }
      return labels.filter((l) => l.length > 0);
    }

    function getDataAttrs(el: Element): Record<string, string> {
      const data: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("data-")) {
          data[attr.name] = attr.value;
        }
      }
      return data;
    }

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    // Standard form elements
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);

      const tag = el.tagName.toLowerCase();
      const input = el as HTMLInputElement;
      const field: any = {
        tag,
        type: input.type || "",
        name: input.name || "",
        id: input.id || "",
        placeholder: input.placeholder || "",
        value: input.value || "",
        classes: (typeof el.className === "string" ? el.className : "") || "",
        visible: isVisible(el),
        labels: getLabels(el),
        dataAttrs: getDataAttrs(el),
      };

      if (tag === "select") {
        const select = el as HTMLSelectElement;
        field.options = Array.from(select.options).map(
          (o) => o.value + " => " + (o.textContent?.trim() || "")
        );
      }

      if (
        field.type === "hidden" &&
        (field.name === "_token" || field.name === "csrf")
      ) {
        return;
      }

      fields.push(field);
    });

    // Custom radio/option divs — broad selector to catch all variations
    document
      .querySelectorAll(
        'div.radio, div.option, div.choice, ' +
          '[role="radio"], [role="option"], [data-value], ' +
          ".radio-button, .option-button, .choice-button, " +
          '[class*="radio"], [class*="option"], [class*="choice"]'
      )
      .forEach((el) => {
        if (seen.has(el)) return;
        // Skip if it's a standard form element
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea") return;
        seen.add(el);

        const text = el.textContent?.trim() || "";
        const dataValue = el.getAttribute("data-value") || "";
        if (!text && !dataValue) return;

        fields.push({
          tag,
          type: "radio-div",
          name:
            el.getAttribute("name") || el.getAttribute("data-name") || "",
          id: el.id || "",
          placeholder: "",
          value: dataValue || text,
          classes: (typeof el.className === "string" ? el.className : "") || "",
          visible: isVisible(el),
          labels: [text],
          dataAttrs: getDataAttrs(el),
        });
      });

    return fields;
  });
}

async function extractClickableOptions(
  page: Page
): Promise<ClickableOption[]> {
  return await page.evaluate(() => {
    const results: any[] = [];
    const candidates = document.querySelectorAll(
      "div.radio, div.option, div.choice, " +
        "button, a.btn, a.btn-next, " +
        '[role="radio"], [role="option"], [role="button"], ' +
        "[data-value], " +
        '[class*="option"], [class*="choice"], [class*="radio"], ' +
        '[class*="answer"], [class*="select-item"], [class*="btn-option"]'
    );
    candidates.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      ) {
        const text = el.textContent?.trim() || "";
        if (text && text.length < 150) {
          const parent = el.parentElement;
          const parentText =
            parent?.getAttribute("aria-label") ||
            parent?.getAttribute("data-question") ||
            "";
          results.push({
            text,
            tag: el.tagName.toLowerCase(),
            classes:
              (typeof el.className === "string"
                ? el.className.substring(0, 120)
                : "") || "",
            dataValue: el.getAttribute("data-value") || "",
            name:
              el.getAttribute("name") || el.getAttribute("data-name") || "",
            parentText,
          });
        }
      }
    });
    return results;
  });
}

/** Get visible heading text for the current step */
async function getStepHeading(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const selectors = [
        "h1", "h2", "h3",
        ".step-title", ".form-title", ".question-title",
        '[class*="heading"]', '[class*="title"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          ) {
            const t = el.textContent?.trim() || "";
            if (t.length > 0 && t.length < 200) return t;
          }
        }
      }
      return "";
    });
  } catch {
    return "";
  }
}

/**
 * Check if the current page is a "radio/option" page (no text inputs, just
 * clickable options). The approach: if there are NO visible text/email/tel
 * inputs and NO selects, it's a radio page.
 */
function isRadioPage(visibleFields: FieldInfo[]): boolean {
  const hasTextInputs = visibleFields.some(
    (f) =>
      f.tag === "input" &&
      f.type !== "hidden" &&
      f.type !== "radio" &&
      f.type !== "checkbox" &&
      f.type !== "submit" &&
      f.type !== "button"
  );
  const hasSelects = visibleFields.some((f) => f.tag === "select");
  return !hasTextInputs && !hasSelects;
}

/**
 * Try to click any visible option on the page to advance.
 * Uses multiple strategies in order of reliability.
 */
async function clickFirstOption(page: Page): Promise<boolean> {
  // Strategy 1: Find all visible clickable elements that look like options
  // Use page.evaluate to find the best clickable element
  const clicked = await page.evaluate(() => {
    // Look for option-like clickable divs (broad search)
    const selectors = [
      "div.radio",
      "div.option",
      "div.choice",
      '[role="radio"]',
      '[role="option"]',
      "[data-value]",
      '[class*="radio"]',
      '[class*="option"]',
      '[class*="choice"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        // Skip standard form elements and navigation
        if (tag === "input" || tag === "select" || tag === "textarea") continue;
        if (tag === "a" && el.classList.contains("btn-next")) continue;
        // Must be visible and have text content
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          el.textContent &&
          el.textContent.trim().length > 0 &&
          el.textContent.trim().length < 100
        ) {
          (el as HTMLElement).click();
          return el.textContent.trim();
        }
      }
    }
    return null;
  });

  if (clicked) {
    console.log('  -> Clicked option (evaluate): "' + clicked + '"');
    return true;
  }

  // Strategy 2: Use Playwright locators with broad text matching
  // Look for any div/span that looks like a button option
  try {
    // Find elements that contain $ (money amounts) — like loan amount buttons
    const moneyOption = page.locator('div:has-text("$")').first();
    if (await moneyOption.isVisible({ timeout: 500 })) {
      // Get the innermost element with $ text
      const innerOption = page
        .locator(
          'div >> text=/^\\$[0-9]/'
        )
        .first();
      if (await innerOption.isVisible({ timeout: 500 })) {
        const text = await innerOption.textContent();
        console.log('  -> Clicked money option: "' + (text?.trim() || "") + '"');
        await innerOption.click();
        return true;
      }
    }
  } catch {
    // continue
  }

  return false;
}

async function main(): Promise<void> {
  const screenshotsDir = path.join(__dirname, "..", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const wsEndpoint = await connectAdsPower();

  console.log("Connecting Playwright to AdsPower browser...");
  const browser: Browser = await chromium.connectOverCDP(wsEndpoint, {
    slowMo: 500,
  });

  const context = browser.contexts()[0];
  const page: Page = context?.pages()[0] || (await context.newPage());

  const allSteps: StepData[] = [];

  try {
    console.log("Navigating to " + TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    console.log("Page loaded\n");
    await sleep(3000);

    let stepNum = 1;
    const maxSteps = 30;
    let previousHeading = "";

    while (stepNum <= maxSteps) {
      await sleep(2000);

      const heading = await getStepHeading(page);
      const fields = await extractFields(page);
      const visibleFields = fields.filter((f: FieldInfo) => f.visible);
      const clickableOptions = await extractClickableOptions(page);

      console.log("\n" + "=".repeat(60));
      console.log("STEP " + stepNum + (heading ? " - " + heading : ""));
      console.log("URL: " + page.url());
      console.log("=".repeat(60));

      const stepData: StepData = {
        step: stepNum,
        url: page.url(),
        title: await page.title(),
        heading,
        fields: visibleFields,
        clickableOptions,
      };
      allSteps.push(stepData);

      logStep(visibleFields, clickableOptions);

      // Screenshot
      const ssPath = path.join(screenshotsDir, "step_" + stepNum + ".png");
      await page.screenshot({ path: ssPath, fullPage: true });
      console.log("  Screenshot saved: " + ssPath);

      // ── DEBUG: Dump the raw HTML of option-like elements ──
      const rawOptions = await page.evaluate(() => {
        const results: string[] = [];
        // Grab outer HTML of first 10 clickable-looking divs
        const allDivs = document.querySelectorAll("div");
        for (const d of Array.from(allDivs).slice(0, 500)) {
          const text = d.textContent?.trim() || "";
          const rect = d.getBoundingClientRect();
          const style = window.getComputedStyle(d);
          // Only visible, short-text divs that look like buttons
          if (
            rect.width > 100 &&
            rect.height > 30 &&
            rect.height < 80 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            text.length > 2 &&
            text.length < 80 &&
            d.children.length <= 3
          ) {
            results.push(
              "<" + d.tagName.toLowerCase() +
              ' class="' + (d.className || "") +
              '" id="' + (d.id || "") +
              '">' + text + " [" +
              Math.round(rect.width) + "x" + Math.round(rect.height) + "]"
            );
          }
          if (results.length >= 15) break;
        }
        return results;
      });
      if (rawOptions.length > 0) {
        console.log("\n  DEBUG - Button-like divs on page:");
        for (const r of rawOptions) {
          console.log("    " + r);
        }
      }

      // ── Advance to next step ──
      const radioPage = isRadioPage(visibleFields);

      if (radioPage) {
        console.log("  [Radio/option page - clicking first option to advance]");

        let advanced = false;

        // Try clicking first option via page.evaluate (direct DOM click)
        advanced = await clickFirstOption(page);

        // Fallback: try clicking any element with short text
        if (!advanced) {
          console.log("  clickFirstOption failed. Trying clickable options from extraction...");
          for (const opt of clickableOptions) {
            // Skip navigation buttons
            if (
              opt.classes.includes("btn-next") ||
              opt.text.toLowerCase().includes("next") ||
              opt.text.toLowerCase().includes("continue") ||
              opt.text.toLowerCase().includes("secure") ||
              opt.text.toLowerCase().includes("disclos")
            ) {
              continue;
            }
            try {
              console.log('  -> Trying text click: "' + opt.text + '"');
              await page.click('text="' + opt.text + '"', { timeout: 3000 });
              advanced = true;
              break;
            } catch {
              continue;
            }
          }
        }

        if (!advanced) {
          console.log("  Could not click any option. End of form.");
          break;
        }
      } else {
        // Page with text inputs / selects: click next button
        console.log("  [Input page - clicking next button to advance]");

        let clicked = false;
        const nextSelectors = [
          "a.btn-next",
          'a:has-text("Next")',
          'a:has-text("Continue")',
          'button:has-text("Continue")',
          'button:has-text("Next")',
          'button[type="submit"]',
          'input[type="submit"]',
        ];

        for (const sel of nextSelectors) {
          try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1000 })) {
              const text = await btn.textContent();
              console.log(
                '  -> Clicking: "' + (text?.trim() || "") + '" (' + sel + ")"
              );
              await btn.click();
              clicked = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!clicked) {
          // Maybe it's actually a radio page we misdetected
          console.log("  No next button found. Trying option click...");
          clicked = await clickFirstOption(page);
        }

        if (!clicked) {
          console.log("  No way to advance. End of form.");
          break;
        }
      }

      await sleep(3000);

      // ── Detect if we actually moved to a new step ──
      const newHeading = await getStepHeading(page);

      if (
        newHeading === heading &&
        heading === previousHeading &&
        stepNum > 1
      ) {
        console.log(
          '  WARNING: Heading unchanged ("' + heading + '"). Might be stuck.'
        );
        // Try clicking a different option
        const retryClicked = await page.evaluate(() => {
          const selectors = [
            "div.radio",
            '[class*="radio"]',
            '[class*="option"]',
            "[data-value]",
          ];
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            // Try the SECOND element (first was already tried)
            if (els.length > 1) {
              const el = els[1];
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              if (
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== "none"
              ) {
                (el as HTMLElement).click();
                return el.textContent?.trim() || "unknown";
              }
            }
          }
          return null;
        });

        if (retryClicked) {
          console.log('  -> Retry clicked: "' + retryClicked + '"');
          await sleep(3000);
        }

        const finalHeading = await getStepHeading(page);
        if (finalHeading === heading) {
          console.log("  Still stuck. Stopping.");
          break;
        }
      }

      previousHeading = heading;
      stepNum++;
    }

    // ── Print final summary ──
    console.log("\n\n" + "=".repeat(70));
    console.log("COMPLETE FORM FIELD MAP (" + allSteps.length + " steps)");
    console.log("=".repeat(70) + "\n");

    for (const step of allSteps) {
      console.log(
        "\n--- Step " +
          step.step +
          (step.heading ? " [" + step.heading + "]" : "") +
          " (" +
          step.url +
          ") ---"
      );
      console.log("Title: " + step.title);
      if (step.fields.length === 0) {
        console.log("  (no visible form fields)");
      }
      for (const f of step.fields) {
        const label = f.labels?.join(", ") || "no label";
        console.log(
          "  " + f.tag + "[type=" + f.type + '] name="' + f.name +
          '" id="' + f.id + '" placeholder="' + f.placeholder +
          '" class="' + f.classes + '" | label: ' + label
        );
        if (f.options) {
          for (const o of f.options) {
            console.log("    option: " + o);
          }
        }
      }
      if (step.clickableOptions.length > 0) {
        console.log("  Clickable options:");
        for (const opt of step.clickableOptions) {
          console.log(
            '    "' + opt.text + '" [' + opt.tag +
            '] class="' + opt.classes +
            '" data-value="' + opt.dataValue +
            '" name="' + opt.name + '"'
          );
        }
      }
    }

    // Save JSON output
    const jsonPath = path.join(screenshotsDir, "form-field-map.json");
    fs.writeFileSync(jsonPath, JSON.stringify(allSteps, null, 2));
    console.log("\nJSON saved to: " + jsonPath);

    console.log("\n" + "=".repeat(70));
    console.log("JSON OUTPUT:");
    console.log("=".repeat(70));
    console.log(JSON.stringify(allSteps, null, 2));
  } catch (error) {
    console.error("Error during form mapping:", error);
    const errorPath = path.join(screenshotsDir, "map_error.png");
    await page
      .screenshot({ path: errorPath, fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
    console.log("\nBrowser closed.");
  }
}

function logStep(
  visibleFields: FieldInfo[],
  clickableOptions: ClickableOption[]
): void {
  if (visibleFields.length === 0) {
    console.log("  No visible form fields found on this step.");
  } else {
    console.log("  Found " + visibleFields.length + " visible fields:");
    for (const f of visibleFields) {
      console.log(
        "    [" + f.tag + '] type="' + f.type +
        '" name="' + f.name + '" id="' + f.id +
        '" placeholder="' + f.placeholder +
        '" value="' + f.value + '" class="' + f.classes + '"'
      );
      if (f.labels && f.labels.length > 0) {
        console.log("           labels: " + f.labels.join(" | "));
      }
      if (f.options && f.options.length > 0) {
        console.log("           options: " + f.options.join(", "));
      }
      if (f.dataAttrs && Object.keys(f.dataAttrs).length > 0) {
        console.log("           data: " + JSON.stringify(f.dataAttrs));
      }
    }
  }

  if (clickableOptions.length > 0) {
    console.log("\n  Clickable option-like elements:");
    for (const opt of clickableOptions) {
      console.log(
        '    [' + opt.tag + '] text="' + opt.text +
        '" data-value="' + opt.dataValue +
        '" name="' + opt.name + '" class="' + opt.classes + '"'
      );
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
