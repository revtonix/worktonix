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

// ── Test lead data ──────────────────────────────────────────────
const lead = {
  loanAmount: "$1000 - $2500",
  firstName: "James",
  lastName: "Mitchell",
  email: "j.mitchell85@gmail.com",
  phone: "2145550182",
  contactTime: "Morning",
  zip: "75201",
  address: "4821 Elm Street",
  city: "Dallas",
  state: "TX",
  homeOwner: "Renter",
  yearsAtAddress: "2 Years",
  dobMonth: "July",
  dobDay: "14",
  dobYear: "1985",
  creditCardDebt: "No",
  unsecuredDebt: "No",
  monthlyPayment: "Yes",
  hasCar: "No",
  monthlyIncome: "$3000-$3500",
  payFrequency: "Bi-Weekly",
  military: "No",
  incomeSource: "Employed",
  employer: "TechCore Solutions",
  timeEmployed: "3 Years",
  workPhone: "2145550199",
  driversLicense: "TX284759218",
  licenseState: "TX",
  ssn: "123454521",
  bankAccountType: "Checking",
  directDeposit: "Yes",
  accountLength: "2 Years",
  creditScore: "Good 600-700",
  loanReason: "Debt Consolidation",
  bankName: "Chase Bank",
  routingNumber: "021000021",
  accountNumber: "123456787834",
};

// ── Helpers ─────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logUrl(page: Page, step: string): Promise<void> {
  console.log("  URL: " + page.url() + " [after " + step + "]");
}

async function fillInput(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  // Wait for the current visible section to be ready before interacting
  await page
    .waitForFunction(
      `document.querySelector('section[aria-hidden="false"]') !== null`,
      { timeout: 5000 }
    )
    .catch(() => {});
  // Use :visible pseudo-class so we don't match hidden inputs from other steps
  const el = page.locator(selector).and(page.locator(":visible")).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  await el.click();
  await el.fill(value);
  console.log("  Filled: " + label + " = " + value);
}

/**
 * Click a radio option by its visible text. Works for plain text divs
 * (like loan amount and contact time on this site).
 */
async function clickRadio(
  page: Page,
  text: string,
  label: string
): Promise<void> {
  const sel = 'text="' + text + '"';
  await page.waitForSelector(sel, { timeout: 8000 });
  await page.click(sel);
  console.log("  Clicked radio: " + label + " = " + text);
  await sleep(2000);
}

/**
 * Click a label-wrapped radio input. This is the pattern used on most
 * radio pages after step 4 (CC Debt, Home Owner, Employment, etc.):
 *   <label><input name="xxx" value="yyy"><span class="label-bg">Text</span></label>
 *
 * Tries multiple strategies in order:
 * 1. label:has(input[name="..."][value="..."])
 * 2. span.label-bg matching text
 * 3. The input itself (and hope label click propagates)
 * 4. Fallback: text="..." match
 *
 * After clicking, also tries a.btn-next in case the page doesn't auto-advance.
 */
async function clickLabelRadio(
  page: Page,
  name: string,
  value: string,
  displayText: string,
  label: string
): Promise<void> {
  let clicked = false;

  // Strategy 1 (fastest): click the label wrapping the input by name+value
  const labelSel = 'label:has(input[name="' + name + '"][value="' + value + '"])';
  try {
    const el = page.locator(labelSel).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.click();
      console.log("  Clicked label: " + label + " [" + labelSel + "]");
      clicked = true;
    }
  } catch {
    // try next
  }

  // Strategy 2: click span.label-bg with matching text
  if (!clicked) {
    try {
      const spanSel = 'span.label-bg:has-text("' + displayText + '")';
      const el = page.locator(spanSel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click();
        console.log("  Clicked span: " + label + " [" + spanSel + "]");
        clicked = true;
      }
    } catch {
      // try next
    }
  }

  // Strategy 3: plain text match (works for plain-div radio pages)
  if (!clicked) {
    try {
      await page.click('text="' + displayText + '"', { timeout: 1500 });
      console.log("  Clicked text: " + label + ' [text="' + displayText + '"]');
      clicked = true;
    } catch {
      // try next
    }
  }

  // Strategy 4: force-click the input directly
  if (!clicked) {
    try {
      const inputSel = 'input[name="' + name + '"][value="' + value + '"]';
      const el = page.locator(inputSel).first();
      await el.click({ force: true, timeout: 1000 });
      console.log("  Clicked input: " + label + " [" + inputSel + "]");
      clicked = true;
    } catch {
      // try next
    }
  }

  // Strategy 5: click label by text content (broadest match)
  if (!clicked) {
    try {
      const el = page.locator('label:has-text("' + displayText + '")').first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click();
        console.log("  Clicked label-text: " + label + ' [label:has-text("' + displayText + '")]');
        clicked = true;
      }
    } catch {
      // give up
    }
  }

  if (!clicked) {
    throw new Error("Could not click " + label + " (name=" + name + " value=" + value + " text=" + displayText + ")");
  }

  await sleep(2000);

  // Some label-radio pages don't auto-advance — try btn-next as fallback
  try {
    const nextBtn = page.locator("a.btn-next").first();
    if (await nextBtn.isVisible({ timeout: 1000 })) {
      await nextBtn.click();
      console.log("  Clicked a.btn-next (fallback)");
      await sleep(1500);
    }
  } catch {
    // auto-advanced, no btn-next needed
  }
}

async function clickNext(page: Page): Promise<void> {
  const nextBtn = page.locator("a.btn-next").first();
  await nextBtn.waitFor({ state: "visible", timeout: 5000 });
  await nextBtn.click();
  console.log("  Clicked: a.btn-next");
  await sleep(3000);
}

async function selectDropdown(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  const el = page.locator(selector).and(page.locator(":visible")).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  await el.selectOption({ label: value });
  console.log("  Selected: " + label + " = " + value);
}

async function screenshotStep(
  page: Page,
  screenshotsDir: string,
  stepName: string
): Promise<void> {
  const safeName = stepName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const ssPath = path.join(screenshotsDir, safeName + ".png");
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log("  Screenshot: " + ssPath);
}

// ── AdsPower connection ─────────────────────────────────────────
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

// ── Main ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const screenshotsDir = path.join(__dirname, "..", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const wsEndpoint = await connectAdsPower();

  console.log("Connecting Playwright to AdsPower browser...");
  const browser: Browser = await chromium.connectOverCDP(wsEndpoint, {
    slowMo: 800,
  });

  const context = browser.contexts()[0];
  const page: Page = context?.pages()[0] || (await context.newPage());

  try {
    console.log("Navigating to " + TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    console.log("Page loaded\n");
    await sleep(3000);

    // ════════════════════════════════════════════════════════════
    // STEP 1: Loan Amount (plain text div, auto-advances)
    // ════════════════════════════════════════════════════════════
    console.log("STEP 1 - Loan Amount");
    await clickRadio(page, lead.loanAmount, "Loan Amount");
    await logUrl(page, "Loan Amount");
    await screenshotStep(page, screenshotsDir, "step01_loan");

    // ════════════════════════════════════════════════════════════
    // STEP 2: Personal Info (text inputs + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 2 - Personal Info");
    await fillInput(page, 'input[name="fname"]', lead.firstName, "First Name");
    await fillInput(page, 'input[name="lname"]', lead.lastName, "Last Name");
    await clickNext(page);
    await fillInput(page, 'input[name="email"]', lead.email, "Email");
    await fillInput(page, 'input[name="phhm"]', lead.phone, "Phone");
    await clickNext(page);
    await logUrl(page, "Personal Info");
    await screenshotStep(page, screenshotsDir, "step02_personal");

    // ════════════════════════════════════════════════════════════
    // STEP 3: Contact Time (plain text div, auto-advances)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 3 - Contact Time");
    await clickRadio(page, lead.contactTime, "Contact Time");
    await logUrl(page, "Contact Time");
    await screenshotStep(page, screenshotsDir, "step03_contact");

    // ════════════════════════════════════════════════════════════
    // STEP 4: Address (text inputs + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 4 - Address");
    await fillInput(page, 'input[name="hpostal"]', lead.zip, "Zip");
    await fillInput(page, 'input[name="haddress1"]', lead.address, "Address");
    await fillInput(page, 'input[name="hcity"]', lead.city, "City");
    try {
      await selectDropdown(page, 'select[name="hstate"]', lead.state, "State");
    } catch {
      await fillInput(page, 'input[name="hstate"]', lead.state, "State");
    }
    await clickNext(page);
    await logUrl(page, "Address");
    await screenshotStep(page, screenshotsDir, "step04_address");

    // ════════════════════════════════════════════════════════════
    // STEP 5: Credit Card Debt (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 5 - Credit Card Debt");
    await clickLabelRadio(page, "i_ad_ccDebtAmt", "0", "No", "CC Debt");
    await logUrl(page, "CC Debt");
    await screenshotStep(page, screenshotsDir, "step05_ccdebt");

    // ════════════════════════════════════════════════════════════
    // STEP 6: Home Owner (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 6 - Home Owner");
    await clickLabelRadio(page, "i_ad_ownHome", "0", lead.homeOwner, "Home Owner");
    await logUrl(page, "Home Owner");
    await screenshotStep(page, screenshotsDir, "step06_homeowner");

    // ════════════════════════════════════════════════════════════
    // STEP 7: Years at Address (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 7 - Years at Address");
    await clickLabelRadio(page, "i_ad_monthsAtAddress", "24", lead.yearsAtAddress, "Years at Address");
    await logUrl(page, "Years at Address");
    await screenshotStep(page, screenshotsDir, "step07_years");

    // ════════════════════════════════════════════════════════════
    // STEP 8: Date of Birth (selects + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 8 - Date of Birth");
    try {
      await selectDropdown(page, 'select[name="dob_m"]', lead.dobMonth, "DOB Month");
    } catch {
      await fillInput(page, 'input[name="dob_m"]', lead.dobMonth, "DOB Month");
    }
    try {
      await selectDropdown(page, 'select[name="dob_d"]', lead.dobDay, "DOB Day");
    } catch {
      await fillInput(page, 'input[name="dob_d"]', lead.dobDay, "DOB Day");
    }
    try {
      await selectDropdown(page, 'select[name="dob_y"]', lead.dobYear, "DOB Year");
    } catch {
      await fillInput(page, 'input[name="dob_y"]', lead.dobYear, "DOB Year");
    }
    await clickNext(page);
    await logUrl(page, "DOB");
    await screenshotStep(page, screenshotsDir, "step08_dob");

    // ════════════════════════════════════════════════════════════
    // STEP 9: Unsecured Debt (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 9 - Unsecured Debt");
    await clickLabelRadio(page, "i_ad_unsecuredDebt", "0", lead.unsecuredDebt, "Unsecured Debt");
    await logUrl(page, "Unsecured Debt");
    await screenshotStep(page, screenshotsDir, "step09_unsecured");

    // ════════════════════════════════════════════════════════════
    // STEP 10: Monthly Payment (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 10 - Monthly Payment");
    await clickLabelRadio(page, "i_ad_monthlyPayment", "1", lead.monthlyPayment, "Monthly Payment");
    await logUrl(page, "Monthly Payment");
    await screenshotStep(page, screenshotsDir, "step10_payment");

    // ════════════════════════════════════════════════════════════
    // STEP 11: Has Car (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 11 - Has Car");
    await clickLabelRadio(page, "i_ad_ownCar", "0", lead.hasCar, "Has Car");
    await logUrl(page, "Has Car");
    await screenshotStep(page, screenshotsDir, "step11_car");

    // ════════════════════════════════════════════════════════════
    // STEP 12: Monthly Income (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 12 - Monthly Income");
    await clickLabelRadio(page, "i_ad_monthlyIncome", "3000", lead.monthlyIncome, "Monthly Income");
    await logUrl(page, "Monthly Income");
    await screenshotStep(page, screenshotsDir, "step12_income");

    // ════════════════════════════════════════════════════════════
    // STEP 13: Pay Frequency (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 13 - Pay Frequency");
    await clickLabelRadio(page, "i_ad_payFrequency", "B", lead.payFrequency, "Pay Frequency");
    await logUrl(page, "Pay Frequency");
    await screenshotStep(page, screenshotsDir, "step13_payfreq");

    // ════════════════════════════════════════════════════════════
    // STEP 14: Military (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 14 - Military");
    await clickLabelRadio(page, "i_ad_activeMilitary", "0", lead.military, "Military");
    await logUrl(page, "Military");
    await screenshotStep(page, screenshotsDir, "step14_military");

    // ════════════════════════════════════════════════════════════
    // STEP 15: Income Source / Employment (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 15 - Income Source / Employment");
    await clickLabelRadio(page, "i_ad_incomeSource", "E", lead.incomeSource, "Income Source");
    await logUrl(page, "Income Source");
    await screenshotStep(page, screenshotsDir, "step15_employment");

    // ════════════════════════════════════════════════════════════
    // STEP 16: Employer Info (text inputs + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 16 - Employer Info");
    try {
      await fillInput(
        page,
        'input[name="employer"], input[name="employerName"], input[placeholder*="Employer"], input[name="i_ad_employer"]',
        lead.employer,
        "Employer"
      );
    } catch (e) {
      console.log("  Employer field not found, skipping: " + e);
    }

    try {
      await clickLabelRadio(page, "i_ad_timeEmployed", "36", lead.timeEmployed, "Time Employed");
    } catch {
      // might be text input or different radio
      try {
        await clickRadio(page, lead.timeEmployed, "Time Employed");
      } catch {
        console.log("  Time Employed not found, skipping");
      }
    }

    try {
      await fillInput(
        page,
        'input[name="work_phone"], input[name="workPhone"], input[name="i_ad_workPhone"], input[placeholder*="Work"]',
        lead.workPhone,
        "Work Phone"
      );
    } catch (e) {
      console.log("  Work phone field not found, skipping: " + e);
    }

    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on employer step.");
    }
    await logUrl(page, "Employer Info");
    await screenshotStep(page, screenshotsDir, "step16_employer");

    // ════════════════════════════════════════════════════════════
    // STEP 17: Identity (DL + SSN, text inputs + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 17 - Identity");
    try {
      await fillInput(
        page,
        'input[name="driver_license"], input[name="dl_number"], input[name="driverLicense"], input[name="i_ad_dlNumber"], input[placeholder*="License"], input[placeholder*="DL"]',
        lead.driversLicense,
        "Drivers License"
      );
    } catch (e) {
      console.log("  DL field not found: " + e);
    }

    try {
      await selectDropdown(
        page,
        'select[name="license_state"], select[name="dl_state"], select[name="licenseState"], select[name="i_ad_dlState"]',
        lead.licenseState,
        "License State"
      );
    } catch {
      try {
        await fillInput(
          page,
          'input[name="license_state"], input[name="dl_state"], input[name="i_ad_dlState"]',
          lead.licenseState,
          "License State"
        );
      } catch (e) {
        console.log("  License state field not found: " + e);
      }
    }

    try {
      await fillInput(
        page,
        'input[name="ssn"], input[name="socialSecurity"], input[name="i_ad_ssn"], input[placeholder*="SSN"], input[placeholder*="Social"]',
        lead.ssn,
        "SSN"
      );
    } catch (e) {
      console.log("  SSN field not found: " + e);
    }

    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on identity step.");
    }
    await logUrl(page, "Identity");
    await screenshotStep(page, screenshotsDir, "step17_identity");

    // ════════════════════════════════════════════════════════════
    // STEP 18: Bank Account Type (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 18 - Bank Account Type");
    try {
      await clickLabelRadio(page, "i_ad_bankAccountType", "C", lead.bankAccountType, "Bank Account Type");
    } catch {
      try { await clickRadio(page, lead.bankAccountType, "Bank Account Type"); } catch {
        console.log("  Bank account type not found.");
      }
    }
    await logUrl(page, "Bank Account Type");
    await screenshotStep(page, screenshotsDir, "step18_banktype");

    // ════════════════════════════════════════════════════════════
    // STEP 19: Direct Deposit (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 19 - Direct Deposit");
    try {
      await clickLabelRadio(page, "i_ad_directDeposit", "1", lead.directDeposit, "Direct Deposit");
    } catch {
      try { await clickRadio(page, lead.directDeposit, "Direct Deposit"); } catch {
        console.log("  Direct deposit not found.");
      }
    }
    await logUrl(page, "Direct Deposit");
    await screenshotStep(page, screenshotsDir, "step19_deposit");

    // ════════════════════════════════════════════════════════════
    // STEP 20: Account Length (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 20 - Account Length");
    try {
      await clickLabelRadio(page, "i_ad_accountLength", "24", lead.accountLength, "Account Length");
    } catch {
      try { await clickRadio(page, lead.accountLength, "Account Length"); } catch {
        console.log("  Account length not found.");
      }
    }
    await logUrl(page, "Account Length");
    await screenshotStep(page, screenshotsDir, "step20_acctlen");

    // ════════════════════════════════════════════════════════════
    // STEP 21: Credit Score (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 21 - Credit Score");
    try {
      await clickLabelRadio(page, "i_ad_creditScore", "600", lead.creditScore, "Credit Score");
    } catch {
      try { await clickRadio(page, lead.creditScore, "Credit Score"); } catch {
        console.log("  Credit score not found.");
      }
    }
    await logUrl(page, "Credit Score");
    await screenshotStep(page, screenshotsDir, "step21_credit");

    // ════════════════════════════════════════════════════════════
    // STEP 22: Loan Reason (label-wrapped radio)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 22 - Loan Reason");
    try {
      await clickLabelRadio(page, "i_ad_loanReason", "DC", lead.loanReason, "Loan Reason");
    } catch {
      try { await clickRadio(page, lead.loanReason, "Loan Reason"); } catch {
        console.log("  Loan reason not found.");
      }
    }
    await logUrl(page, "Loan Reason");
    await screenshotStep(page, screenshotsDir, "step22_reason");

    // ════════════════════════════════════════════════════════════
    // STEP 23: Bank Details (text inputs + a.btn-next)
    // ════════════════════════════════════════════════════════════
    console.log("\nSTEP 23 - Bank Details");
    try {
      await fillInput(
        page,
        'input[name="bank_name"], input[name="bankName"], input[name="i_ad_bankName"], input[placeholder*="Bank"]',
        lead.bankName,
        "Bank Name"
      );
    } catch (e) {
      console.log("  Bank name field not found: " + e);
    }

    try {
      await fillInput(
        page,
        'input[name="routing_number"], input[name="routingNumber"], input[name="i_ad_routingNumber"], input[name="aba"], input[placeholder*="Routing"]',
        lead.routingNumber,
        "Routing Number"
      );
    } catch (e) {
      console.log("  Routing number field not found: " + e);
    }

    try {
      await fillInput(
        page,
        'input[name="account_number"], input[name="accountNumber"], input[name="i_ad_accountNumber"], input[placeholder*="Account"]',
        lead.accountNumber,
        "Account Number"
      );
    } catch (e) {
      console.log("  Account number field not found: " + e);
    }

    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on bank details step.");
    }
    await logUrl(page, "Bank Details");
    await screenshotStep(page, screenshotsDir, "step23_bank");

    // ════════════════════════════════════════════════════════════
    // DONE
    // ════════════════════════════════════════════════════════════
    console.log("\n" + "=".repeat(60));
    console.log("ALL STEPS COMPLETED!");
    console.log("Final URL: " + page.url());
    console.log("=".repeat(60));

    const screenshotPath = path.join(screenshotsDir, "test_final.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("Final screenshot: " + screenshotPath);

    console.log("Waiting 30 seconds for manual review...");
    await sleep(30000);
    console.log("Review period complete.");
  } catch (error) {
    console.error("Error during form filling:", error);
    const errorPath = path.join(screenshotsDir, "error.png");
    await page
      .screenshot({ path: errorPath, fullPage: true })
      .catch(() => {});
    console.error("Error screenshot saved: " + errorPath);
    throw error;
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
