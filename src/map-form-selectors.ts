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
      // Check preceding sibling or parent for label-like text
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

      // Skip csrf tokens
      if (
        field.type === "hidden" &&
        (field.name === "_token" || field.name === "csrf")
      ) {
        return;
      }

      fields.push(field);
    });

    // Radio-style clickable elements (custom radio buttons)
    document
      .querySelectorAll(
        '[role="radio"], [role="option"], [data-value], ' +
          ".radio-button, .option-button, .choice-button, " +
          '[class*="radio"], [class*="option"], [class*="choice"]'
      )
      .forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const text = el.textContent?.trim() || "";
        const dataValue = el.getAttribute("data-value") || "";
        if (!text && !dataValue) return;

        fields.push({
          tag: el.tagName.toLowerCase(),
          type: "radio-button",
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

async function extractClickableOptions(page: Page): Promise<ClickableOption[]> {
  return await page.evaluate(() => {
    const results: any[] = [];
    const candidates = document.querySelectorAll(
      "button, a.btn, " +
        '[role="radio"], [role="option"], [role="button"], ' +
        "[data-value], " +
        '[class*="option"], [class*="choice"], [class*="radio"], ' +
        '[class*="answer"], [class*="select-item"], [class*="btn-option"], ' +
        "li[class], .card, [class*=\"step\"]"
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
          // Get parent context for grouping
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

async function findAndClickNext(page: Page): Promise<boolean> {
  const buttonSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'button:has-text("CONTINUE")',
    'button:has-text("NEXT")',
    'a:has-text("Continue")',
    'a:has-text("Next")',
    'input[type="submit"]',
    'button[type="submit"]',
    ".continue-btn",
    ".next-btn",
    '[class*="continue"]',
    '[class*="next-step"]',
    'button:has-text("Proceed")',
    'button:has-text("Start")',
    'button:has-text("BEGIN")',
    'button:has-text("Get Started")',
    'button:has-text("Apply")',
    'button:has-text("APPLY")',
    'button:has-text("Submit")',
    'button:has-text("SUBMIT")',
  ];

  for (const sel of buttonSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        const text = await btn.textContent();
        console.log('  -> Clicking: "' + (text?.trim() || "") + '" (' + sel + ")");
        await btn.click();
        return true;
      }
    } catch {
      // try next selector
    }
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
    const maxSteps = 20;

    while (stepNum <= maxSteps) {
      console.log("\n" + "=".repeat(60));
      console.log("STEP " + stepNum);
      console.log("URL: " + page.url());
      console.log("=".repeat(60));

      await sleep(2000);

      const fields = await extractFields(page);
      const visibleFields = fields.filter((f: FieldInfo) => f.visible);
      const clickableOptions = await extractClickableOptions(page);

      const stepData: StepData = {
        step: stepNum,
        url: page.url(),
        title: await page.title(),
        fields: visibleFields,
        clickableOptions,
      };
      allSteps.push(stepData);

      if (visibleFields.length === 0) {
        console.log("  No visible form fields found on this step.");
      } else {
        console.log("  Found " + visibleFields.length + " visible fields:");
        for (const f of visibleFields) {
          console.log(
            '    [' + f.tag + '] type="' + f.type + '" name="' + f.name +
            '" id="' + f.id + '" placeholder="' + f.placeholder +
            '" value="' + f.value + '"'
          );
          if (f.labels && f.labels.length > 0) {
            console.log("           labels: " + f.labels.join(" | "));
          }
          if (f.options && f.options.length > 0) {
            console.log("           options: " + f.options.join(", "));
          }
          if (f.dataAttrs && Object.keys(f.dataAttrs).length > 0) {
            console.log(
              "           data: " + JSON.stringify(f.dataAttrs)
            );
          }
        }
      }

      if (clickableOptions.length > 0) {
        console.log("\n  Clickable option-like elements:");
        for (const opt of clickableOptions) {
          console.log(
            '    [' + opt.tag + '] text="' + opt.text +
            '" data-value="' + opt.dataValue +
            '" name="' + opt.name +
            '" class="' + opt.classes + '"'
          );
        }
      }

      // Screenshot each step
      const ssPath = path.join(screenshotsDir, "step_" + stepNum + ".png");
      await page.screenshot({ path: ssPath, fullPage: true });
      console.log("  Screenshot saved: " + ssPath);

      // Try to advance to next step
      const pageContentBefore = await page.content();
      const urlBefore = page.url();

      const clicked = await findAndClickNext(page);
      if (!clicked) {
        console.log("\n  No next/continue button found. End of form steps.");
        break;
      }

      await sleep(3000);

      // Check if page actually changed
      const urlAfter = page.url();
      const pageContentAfter = await page.content();

      if (urlAfter === urlBefore && pageContentAfter === pageContentBefore) {
        console.log(
          "  Page did not change after clicking. May need required fields filled first."
        );
        break;
      }

      stepNum++;
    }

    // Print final summary
    console.log("\n\n" + "=".repeat(70));
    console.log("COMPLETE FORM FIELD MAP");
    console.log("=".repeat(70) + "\n");

    for (const step of allSteps) {
      console.log("\n--- Step " + step.step + " (" + step.url + ") ---");
      console.log("Title: " + step.title);
      if (step.fields.length === 0) {
        console.log("  (no visible form fields)");
      }
      for (const f of step.fields) {
        const label = f.labels?.join(", ") || "no label";
        console.log(
          "  " + f.tag + "[type=" + f.type + '] name="' + f.name +
          '" id="' + f.id + '" placeholder="' + f.placeholder +
          '" | label: ' + label
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
            '    "' + opt.text + '" (data-value="' + opt.dataValue +
            '", name="' + opt.name + '")'
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

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
