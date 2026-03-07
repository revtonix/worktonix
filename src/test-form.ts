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
  homeOwner: "Rent",
  yearsAtAddress: "2 Years",
  dobMonth: "July",
  dobDay: "14",
  dobYear: "1985",
  creditCardDebt: "No",      // i_ad_ccDebtAmt value=0
  unsecuredDebt10k: "No",
  monthlyPayment250: "Yes",
  hasCar: "No",
  monthlyIncome: "$3000-$3500",
  payFrequency: "Bi-Weekly",
  military: "No",
  incomeSource: "Employment",
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

async function fillInput(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
  await page.fill(selector, value);
  console.log("  Filled: " + label + " = " + value);
}

async function clickRadio(
  page: Page,
  text: string,
  label: string
): Promise<void> {
  // Use exact text match — this is what works on this site
  const sel = 'text="' + text + '"';
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.click(sel);
  console.log("  Clicked radio: " + label + " = " + text);
  await sleep(1500);
}

async function clickNext(page: Page): Promise<void> {
  const nextBtn = page.locator("a.btn-next").first();
  await nextBtn.waitFor({ state: "visible", timeout: 10000 });
  await nextBtn.click();
  console.log("  Clicked: a.btn-next");
  await sleep(2000);
}

async function selectDropdown(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.selectOption(selector, { label: value });
  console.log("  Selected: " + label + " = " + value);
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

    // ── Step 1: Loan Amount (div.radio, auto-advances) ──
    console.log("STEP 1 - Loan Amount");
    await clickRadio(page, lead.loanAmount, "Loan Amount");
    await sleep(2000);

    // ── Step 2: Personal Info (text inputs + a.btn-next) ──
    console.log("\nSTEP 2 - Personal Info");
    await fillInput(page, 'input[name="fname"]', lead.firstName, "First Name");
    await fillInput(page, 'input[name="lname"]', lead.lastName, "Last Name");
    await fillInput(page, 'input[name="email"]', lead.email, "Email");
    await fillInput(page, 'input[name="phhm"]', lead.phone, "Phone");
    await clickNext(page);

    // ── Step 3: Contact Time (div.radio, auto-advances) ──
    console.log("\nSTEP 3 - Contact Time");
    await clickRadio(page, lead.contactTime, "Contact Time");
    await sleep(2000);

    // ── Step 4: Address (text inputs + a.btn-next) ──
    console.log("\nSTEP 4 - Address");
    await fillInput(page, 'input[name="hpostal"]', lead.zip, "Zip");
    await fillInput(page, 'input[name="haddress1"]', lead.address, "Address");
    await fillInput(page, 'input[name="hcity"]', lead.city, "City");
    // State — try select first, then text click
    try {
      await selectDropdown(page, 'select[name="hstate"]', lead.state, "State");
    } catch {
      await fillInput(page, 'input[name="hstate"]', lead.state, "State");
    }
    await clickNext(page);

    // ── Step 5: Credit Card Debt (div.radio, auto-advances) ──
    console.log("\nSTEP 5 - Credit Card Debt");
    await clickRadio(page, lead.creditCardDebt, "Credit Card Debt");
    await sleep(2000);

    // ── Step 6: Home Owner (div.radio, auto-advances) ──
    console.log("\nSTEP 6 - Home Owner");
    await clickRadio(page, lead.homeOwner, "Home Owner");
    await sleep(2000);

    // ── Step 7: Years at Address (div.radio, auto-advances) ──
    console.log("\nSTEP 7 - Years at Address");
    await clickRadio(page, lead.yearsAtAddress, "Years at Address");
    await sleep(2000);

    // ── Step 8: Date of Birth (selects/inputs + a.btn-next) ──
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

    // ── Step 9+: Remaining radio/option steps ──
    // These are radio-only pages that auto-advance on click.
    // The exact order may vary — run map-form-selectors.ts to confirm.

    console.log("\nSTEP 9 - Unsecured Debt");
    await clickRadio(page, lead.unsecuredDebt10k, "Unsecured Debt 10k+");
    await sleep(2000);

    console.log("\nSTEP 10 - Monthly Payment");
    await clickRadio(page, lead.monthlyPayment250, "Monthly Payment $250");
    await sleep(2000);

    console.log("\nSTEP 11 - Has Car");
    await clickRadio(page, lead.hasCar, "Has Car");
    await sleep(2000);

    console.log("\nSTEP 12 - Monthly Income");
    await clickRadio(page, lead.monthlyIncome, "Monthly Income");
    await sleep(2000);

    console.log("\nSTEP 13 - Pay Frequency");
    await clickRadio(page, lead.payFrequency, "Pay Frequency");
    await sleep(2000);

    console.log("\nSTEP 14 - Military");
    await clickRadio(page, lead.military, "Military");
    await sleep(2000);

    console.log("\nSTEP 15 - Income Source / Employment");
    await clickRadio(page, lead.incomeSource, "Income Source");
    await sleep(2000);

    // ── Employment details (text inputs + a.btn-next) ──
    console.log("\nSTEP 16 - Employer Info");
    // Try known field names — mapper will confirm exact names
    try {
      await fillInput(
        page,
        'input[name="employer"], input[name="employerName"], input[placeholder*="Employer"]',
        lead.employer,
        "Employer"
      );
    } catch (e) {
      console.log("  Employer field not found, skipping: " + e);
    }

    try {
      await clickRadio(page, lead.timeEmployed, "Time Employed");
      await sleep(2000);
    } catch {
      console.log("  Time Employed radio not found, trying next...");
    }

    try {
      await fillInput(
        page,
        'input[name="work_phone"], input[name="workPhone"], input[placeholder*="Work"]',
        lead.workPhone,
        "Work Phone"
      );
    } catch (e) {
      console.log("  Work phone field not found, skipping: " + e);
    }

    // Try clicking next if there's a btn-next visible
    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on this step.");
    }

    // ── Identity fields ──
    console.log("\nSTEP 17 - Identity");
    try {
      await fillInput(
        page,
        'input[name="driver_license"], input[name="dl_number"], input[name="driverLicense"], input[placeholder*="License"], input[placeholder*="DL"]',
        lead.driversLicense,
        "Drivers License"
      );
    } catch (e) {
      console.log("  DL field not found: " + e);
    }

    try {
      await selectDropdown(
        page,
        'select[name="license_state"], select[name="dl_state"], select[name="licenseState"]',
        lead.licenseState,
        "License State"
      );
    } catch {
      try {
        await fillInput(
          page,
          'input[name="license_state"], input[name="dl_state"]',
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
        'input[name="ssn"], input[name="socialSecurity"], input[placeholder*="SSN"], input[placeholder*="Social"]',
        lead.ssn,
        "SSN"
      );
    } catch (e) {
      console.log("  SSN field not found: " + e);
    }

    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on this step.");
    }

    // ── Banking ──
    console.log("\nSTEP 18 - Banking");
    try {
      await clickRadio(page, lead.bankAccountType, "Bank Account Type");
      await sleep(2000);
    } catch {
      console.log("  Bank account type radio not found.");
    }

    try {
      await clickRadio(page, lead.directDeposit, "Direct Deposit");
      await sleep(2000);
    } catch {
      console.log("  Direct deposit radio not found.");
    }

    try {
      await clickRadio(page, lead.accountLength, "Account Length");
      await sleep(2000);
    } catch {
      console.log("  Account length radio not found.");
    }

    try {
      await clickRadio(page, lead.creditScore, "Credit Score");
      await sleep(2000);
    } catch {
      console.log("  Credit score radio not found.");
    }

    try {
      await clickRadio(page, lead.loanReason, "Loan Reason");
      await sleep(2000);
    } catch {
      console.log("  Loan reason radio not found.");
    }

    // ── Bank details (text inputs) ──
    console.log("\nSTEP 19 - Bank Details");
    try {
      await fillInput(
        page,
        'input[name="bank_name"], input[name="bankName"], input[placeholder*="Bank"]',
        lead.bankName,
        "Bank Name"
      );
    } catch (e) {
      console.log("  Bank name field not found: " + e);
    }

    try {
      await fillInput(
        page,
        'input[name="routing_number"], input[name="routingNumber"], input[name="aba"], input[placeholder*="Routing"]',
        lead.routingNumber,
        "Routing Number"
      );
    } catch (e) {
      console.log("  Routing number field not found: " + e);
    }

    try {
      await fillInput(
        page,
        'input[name="account_number"], input[name="accountNumber"], input[placeholder*="Account"]',
        lead.accountNumber,
        "Account Number"
      );
    } catch (e) {
      console.log("  Account number field not found: " + e);
    }

    try {
      await clickNext(page);
    } catch {
      console.log("  No next button on this step.");
    }

    console.log("\nAll steps completed!");

    // Screenshot final state (DO NOT click submit)
    const screenshotPath = path.join(screenshotsDir, "test_filled.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("Screenshot saved: " + screenshotPath);

    // Wait for manual review
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
