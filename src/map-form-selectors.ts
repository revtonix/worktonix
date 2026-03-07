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

    // Custom radio/option divs (div.radio, etc.)
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
        '[class*="option"], [class*="choice"], ' +
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

/** Get the current step's visible heading text (h1, h2, h3, or .step-title) */
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
 * Detect if the current step is a "radio-only" page (no text inputs/selects,
 * just radio divs to click). These pages typically auto-advance on click.
 */
function isRadioOnlyStep(visibleFields: FieldInfo[]): boolean {
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
  const hasRadioDivs = visibleFields.some(
    (f) => f.type === "radio-div" || (f.tag === "div" && f.classes.includes("radio"))
  );
  return !hasTextInputs && !hasSelects && hasRadioDivs;
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

      // ── Advance to next step ──
      const radioOnly = isRadioOnlyStep(visibleFields);

      if (radioOnly) {
        // Radio-only page: click the first div.radio to auto-advance
        const firstRadio = page.locator("div.radio").first();
        try {
          if (await firstRadio.isVisible({ timeout: 2000 })) {
            const text = await firstRadio.textContent();
            console.log(
              '  -> Clicking first div.radio: "' + (text?.trim() || "") + '"'
            );
            await firstRadio.click();
          } else {
            console.log("  No visible div.radio found. Trying text-based click...");
            // Fallback: try clicking the first clickable option by exact text
            if (clickableOptions.length > 0) {
              const firstOpt = clickableOptions[0];
              console.log(
                '  -> Clicking option by text: "' + firstOpt.text + '"'
              );
              await page.click('text="' + firstOpt.text + '"');
            } else {
              console.log("  No options to click. End of form.");
              break;
            }
          }
        } catch (e) {
          console.log("  Error clicking radio: " + e);
          break;
        }
      } else {
        // Page with text inputs / selects: click a.btn-next to advance
        let clicked = false;

        // Try a.btn-next first (the site's primary next button)
        try {
          const nextBtn = page.locator("a.btn-next").first();
          if (await nextBtn.isVisible({ timeout: 2000 })) {
            const text = await nextBtn.textContent();
            console.log(
              '  -> Clicking a.btn-next: "' + (text?.trim() || "") + '"'
            );
            await nextBtn.click();
            clicked = true;
          }
        } catch {
          // not found
        }

        // Fallback: other button selectors
        if (!clicked) {
          const fallbackSelectors = [
            'button:has-text("Continue")',
            'button:has-text("Next")',
            'button[type="submit"]',
            'input[type="submit"]',
            'a:has-text("Continue")',
            'a:has-text("Next")',
          ];
          for (const sel of fallbackSelectors) {
            try {
              const btn = page.locator(sel).first();
              if (await btn.isVisible({ timeout: 500 })) {
                const text = await btn.textContent();
                console.log(
                  '  -> Clicking fallback: "' +
                    (text?.trim() || "") +
                    '" (' +
                    sel +
                    ")"
                );
                await btn.click();
                clicked = true;
                break;
              }
            } catch {
              // try next
            }
          }
        }

        if (!clicked) {
          // Last resort: maybe it's a radio page we didn't detect
          try {
            const radio = page.locator("div.radio").first();
            if (await radio.isVisible({ timeout: 500 })) {
              const text = await radio.textContent();
              console.log(
                '  -> Last resort div.radio click: "' + (text?.trim() || "") + '"'
              );
              await radio.click();
              clicked = true;
            }
          } catch {
            // nothing
          }
        }

        if (!clicked) {
          console.log("  No next button or clickable option found. End of form.");
          break;
        }
      }

      await sleep(3000);

      // Detect if we actually moved to a new step by checking heading change
      const newHeading = await getStepHeading(page);
      if (newHeading === previousHeading && newHeading === heading && stepNum > 1) {
        // Heading didn't change — might be stuck
        console.log(
          '  Warning: heading unchanged ("' + heading + '"). May be stuck.'
        );
        // Try clicking next radio option
        try {
          const radios = page.locator("div.radio");
          const count = await radios.count();
          for (let i = 1; i < count; i++) {
            const r = radios.nth(i);
            if (await r.isVisible({ timeout: 500 })) {
              const text = await r.textContent();
              console.log(
                '  -> Retry with radio #' + (i + 1) + ': "' + (text?.trim() || "") + '"'
              );
              await r.click();
              await sleep(3000);
              const retryHeading = await getStepHeading(page);
              if (retryHeading !== heading) break;
            }
          }
        } catch {
          // give up
        }

        const finalHeading = await getStepHeading(page);
        if (finalHeading === heading) {
          console.log("  Still stuck after retries. Stopping.");
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
        "\n--- Step " + step.step +
        (step.heading ? " [" + step.heading + "]" : "") +
        " (" + step.url + ") ---"
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
