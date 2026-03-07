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

    // Custom radio/option divs (div.radio, div.option, etc.)
    document
      .querySelectorAll(
        'div.radio, div.option, div.choice, ' +
          '[role="radio"], [role="option"], [data-value], ' +
          ".radio-button, .option-button, .choice-button"
      )
      .forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const text = el.textContent?.trim() || "";
        const dataValue = el.getAttribute("data-value") || "";
        if (!text && !dataValue) return;

        fields.push({
          tag: el.tagName.toLowerCase(),
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
        '[class*="answer"], [class*="select-item"], [class*="btn-option"], ' +
        "li[class], .card"
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

/**
 * Advance the form to the next step. Strategy:
 * 1. Try clicking a.btn-next (the site's actual next button)
 * 2. Try other common next/continue button selectors
 * 3. If no next button, click the first visible div.radio option
 *    (radio-only pages auto-advance on click)
 */
async function advanceStep(page: Page): Promise<boolean> {
  // Priority 1: a.btn-next (the site's known next button)
  const nextBtnSelectors = [
    "a.btn-next",
    'a:has-text("Next")',
    'a:has-text("Continue")',
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'button:has-text("CONTINUE")',
    'button:has-text("NEXT")',
    'input[type="submit"]',
    'button[type="submit"]',
    ".continue-btn",
    ".next-btn",
    'button:has-text("Proceed")',
    'button:has-text("Get Started")',
    'button:has-text("Apply")',
    'button:has-text("Submit")',
  ];

  for (const sel of nextBtnSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 })) {
        const text = await btn.textContent();
        console.log(
          '  -> Clicking next button: "' +
            (text?.trim() || "") +
            '" (' +
            sel +
            ")"
        );
        await btn.click();
        return true;
      }
    } catch {
      // try next selector
    }
  }

  // Priority 2: Click the first visible div.radio option
  // (radio-only pages like Contact Time, Credit Card Debt, etc.)
  try {
    const radioDiv = page.locator("div.radio").first();
    if (await radioDiv.isVisible({ timeout: 500 })) {
      const text = await radioDiv.textContent();
      console.log(
        '  -> Clicking first radio option: "' + (text?.trim() || "") + '"'
      );
      await radioDiv.click();
      return true;
    }
  } catch {
    // no radio divs
  }

  // Priority 3: Any clickable option-like element
  const optionSelectors = [
    'div[class*="option"]',
    'div[class*="choice"]',
    '[role="radio"]',
    '[role="option"]',
    "[data-value]",
  ];
  for (const sel of optionSelectors) {
    try {
      const opt = page.locator(sel).first();
      if (await opt.isVisible({ timeout: 500 })) {
        const text = await opt.textContent();
        console.log(
          '  -> Clicking first option: "' +
            (text?.trim() || "") +
            '" (' +
            sel +
            ")"
        );
        await opt.click();
        return true;
      }
    } catch {
      // try next
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

    // ── Step 1: Loan Amount page ──
    // Map the initial page first, then click "$1000 - $2500" to advance
    console.log("\n" + "=".repeat(60));
    console.log("STEP 1 - Loan Amount");
    console.log("URL: " + page.url());
    console.log("=".repeat(60));

    await sleep(2000);
    const step1Fields = await extractFields(page);
    const step1Visible = step1Fields.filter((f: FieldInfo) => f.visible);
    const step1Options = await extractClickableOptions(page);

    allSteps.push({
      step: 1,
      url: page.url(),
      title: await page.title(),
      fields: step1Visible,
      clickableOptions: step1Options,
    });

    logStep(step1Visible, step1Options);

    const ssPath1 = path.join(screenshotsDir, "step_1.png");
    await page.screenshot({ path: ssPath1, fullPage: true });
    console.log("  Screenshot saved: " + ssPath1);

    // Click the "$1000 - $2500" loan amount radio div to advance
    console.log('\n  -> Clicking loan amount: "$1000 - $2500"');
    const loanBtn = page.locator('div.radio:has-text("$1000 - $2500")').first();
    await loanBtn.click();
    await sleep(3000);

    // ── Steps 2+: Loop through remaining form steps ──
    let stepNum = 2;
    const maxSteps = 25;
    let stuckCount = 0;

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

      logStep(visibleFields, clickableOptions);

      // Screenshot each step
      const ssPath = path.join(screenshotsDir, "step_" + stepNum + ".png");
      await page.screenshot({ path: ssPath, fullPage: true });
      console.log("  Screenshot saved: " + ssPath);

      // Capture page state before advancing
      const htmlBefore = await page.content();
      const urlBefore = page.url();

      // Determine how to advance:
      // - If there are text inputs visible, we can't fill them, so try a.btn-next
      // - If only radio divs, click the first one (auto-advances)
      // - Otherwise try any next button
      const hasTextInputs = visibleFields.some(
        (f) =>
          f.tag === "input" &&
          (f.type === "text" ||
            f.type === "email" ||
            f.type === "tel" ||
            f.type === "number" ||
            f.type === "password" ||
            f.type === "")
      );
      const hasSelectDropdowns = visibleFields.some((f) => f.tag === "select");
      const hasRadioDivs = visibleFields.some(
        (f) => f.type === "radio-div" || f.classes.includes("radio")
      );

      let advanced = false;

      if (hasTextInputs || hasSelectDropdowns) {
        // Page has input fields - try clicking a.btn-next directly
        // (fields won't be filled, but we map what's there and move on)
        try {
          const nextBtn = page.locator("a.btn-next").first();
          if (await nextBtn.isVisible({ timeout: 1000 })) {
            const text = await nextBtn.textContent();
            console.log(
              '  -> Clicking a.btn-next: "' + (text?.trim() || "") + '"'
            );
            await nextBtn.click();
            advanced = true;
          }
        } catch {
          // fall through
        }

        if (!advanced) {
          advanced = await advanceStep(page);
        }
      } else if (hasRadioDivs) {
        // Radio-only page: click the first radio option
        try {
          const radioDiv = page.locator("div.radio").first();
          if (await radioDiv.isVisible({ timeout: 1000 })) {
            const text = await radioDiv.textContent();
            console.log(
              '  -> Clicking first div.radio: "' + (text?.trim() || "") + '"'
            );
            await radioDiv.click();
            advanced = true;
          }
        } catch {
          // fall through
        }

        if (!advanced) {
          advanced = await advanceStep(page);
        }
      } else {
        // Generic: try all advance strategies
        advanced = await advanceStep(page);
      }

      if (!advanced) {
        console.log("\n  No clickable element found. End of form steps.");
        break;
      }

      await sleep(3000);

      // Check if page actually changed
      const urlAfter = page.url();
      const htmlAfter = await page.content();

      if (urlAfter === urlBefore && htmlAfter === htmlBefore) {
        stuckCount++;
        console.log(
          "  Page did not change after clicking (attempt " +
            stuckCount +
            "/3)."
        );
        if (stuckCount >= 3) {
          console.log("  Stuck for 3 attempts. Stopping.");
          break;
        }
        // Try a different approach: click the next radio option
        try {
          const radios = page.locator("div.radio");
          const count = await radios.count();
          if (count > stuckCount) {
            const radio = radios.nth(stuckCount);
            const text = await radio.textContent();
            console.log(
              '  -> Trying radio option #' +
                (stuckCount + 1) +
                ': "' +
                (text?.trim() || "") +
                '"'
            );
            await radio.click();
            await sleep(3000);
          }
        } catch {
          // give up
        }
      } else {
        stuckCount = 0;
      }

      stepNum++;
    }

    // ── Print final summary ──
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
          "  " +
            f.tag +
            "[type=" +
            f.type +
            '] name="' +
            f.name +
            '" id="' +
            f.id +
            '" placeholder="' +
            f.placeholder +
            '" | label: ' +
            label
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
            '    "' +
              opt.text +
              '" [' +
              opt.tag +
              '] class="' +
              opt.classes +
              '" data-value="' +
              opt.dataValue +
              '" name="' +
              opt.name +
              '"'
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
        "    [" +
          f.tag +
          '] type="' +
          f.type +
          '" name="' +
          f.name +
          '" id="' +
          f.id +
          '" placeholder="' +
          f.placeholder +
          '" value="' +
          f.value +
          '" class="' +
          f.classes +
          '"'
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
        '    [' +
          opt.tag +
          '] text="' +
          opt.text +
          '" data-value="' +
          opt.dataValue +
          '" name="' +
          opt.name +
          '" class="' +
          opt.classes +
          '"'
      );
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
