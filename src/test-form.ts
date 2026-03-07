import { chromium, Browser, Page } from "playwright";
import axios from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const ADSPOWER_API = "http://local.adspower.net:50325";
const PROFILE_ID = process.env.ADSPOWER_PROFILE_ID || "YOUR_PROFILE_ID";
const TARGET_URL = "https://www.unitedemergencyrelief.com/";

// Test lead data
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
  residence: "Rent",
  yearsAtAddress: "2 Years",
  dobMonth: "July",
  dobDay: "14",
  dobYear: "1985",
  creditCardDebt10k: "No",
  unsecuredDebt10k: "No",
  monthlyPayment250: "Yes",
  hasCar: "No",
  monthlyIncome: "$3000 - $3500",
  payFrequency: "Bi-Weekly",
  military: "No",
  incomeSource: "Employment",
  employer: "TechCore Solutions",
  timeEmployed: "3 Years",
  workPhone: "2145550199",
  driverLicense: "TX284759218",
  licenseState: "TX",
  ssn: "123-45-4521",
  bankAccountType: "Checking",
  directDeposit: "Yes",
  accountLength: "2 Years",
  creditScore: "Good 600-700",
  loanReason: "Debt Consolidation",
  bankName: "Chase Bank",
  routingNumber: "021000021",
  accountNumber: "123456787834",
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: select a dropdown/select option by visible text.
 * Tries <select> first, then falls back to clicking an option element.
 */
async function selectOption(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 15000 });
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);

  const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
  if (tagName === "select") {
    await page.selectOption(selector, { label: value });
  } else {
    await el.click();
    await sleep(300);
    // Try to click the matching option text
    await page.click(`text="${value}"`);
  }
}

/**
 * Helper: fill a text input field.
 */
async function fillField(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
  await page.fill(selector, value);
}

/**
 * Helper: click a radio/button option that contains specific text.
 */
async function clickOption(page: Page, text: string): Promise<void> {
  const selector = `text="${text}"`;
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
}

/**
 * Helper: click a button/element matching a selector.
 */
async function clickElement(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
}

async function startAdsPowerBrowser(): Promise<string> {
  console.log(`[1/5] Starting AdsPower browser for profile: ${PROFILE_ID}`);
  const response = await axios.get(`${ADSPOWER_API}/api/v1/browser/start`, {
    params: { user_id: PROFILE_ID },
  });

  const data = response.data;
  if (data.code !== 0) {
    throw new Error(`AdsPower API error: ${data.msg}`);
  }

  const wsUrl = data.data.ws?.puppeteer || data.data.ws;
  if (!wsUrl) {
    throw new Error("No websocket URL returned from AdsPower");
  }

  console.log(`   WebSocket URL: ${wsUrl}`);
  return wsUrl;
}

async function main(): Promise<void> {
  // Ensure screenshots directory exists
  const screenshotsDir = path.join(__dirname, "..", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Step 1: Connect to AdsPower browser
  const wsUrl = await startAdsPowerBrowser();

  console.log("[2/5] Connecting Playwright to AdsPower browser...");
  const browser: Browser = await chromium.connectOverCDP(wsUrl, {
    slowMo: 800,
  });

  const defaultContext = browser.contexts()[0];
  const page: Page = defaultContext?.pages()[0] || (await defaultContext.newPage());

  try {
    // Step 2: Navigate to target URL
    console.log(`[3/5] Navigating to ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    console.log("   Page loaded successfully.");
    await sleep(2000);

    // Step 3: Fill the form
    console.log("[4/5] Filling form with test lead data...");

    // --- Loan Amount ---
    console.log("   Selecting loan amount...");
    await clickOption(page, lead.loanAmount);
    await sleep(500);

    // --- Personal Information ---
    console.log("   Filling first name...");
    await fillField(page, 'input[name="first_name"], input[name="firstName"], input[placeholder*="First"]', lead.firstName);

    console.log("   Filling last name...");
    await fillField(page, 'input[name="last_name"], input[name="lastName"], input[placeholder*="Last"]', lead.lastName);

    console.log("   Filling email...");
    await fillField(page, 'input[name="email"], input[type="email"], input[placeholder*="Email"]', lead.email);

    console.log("   Filling phone...");
    await fillField(page, 'input[name="phone"], input[type="tel"], input[placeholder*="Phone"]', lead.phone);

    // --- Contact Time ---
    console.log("   Selecting contact time...");
    await clickOption(page, lead.contactTime);
    await sleep(500);

    // --- Address ---
    console.log("   Filling zip code...");
    await fillField(page, 'input[name="zip"], input[name="zipCode"], input[placeholder*="Zip"]', lead.zip);

    console.log("   Filling address...");
    await fillField(page, 'input[name="address"], input[name="street"], input[placeholder*="Address"]', lead.address);

    console.log("   Filling city...");
    await fillField(page, 'input[name="city"], input[placeholder*="City"]', lead.city);

    // --- State ---
    console.log("   Selecting state...");
    try {
      await selectOption(page, 'select[name="state"]', lead.state);
    } catch {
      await clickOption(page, lead.state);
    }

    // --- Residence ---
    console.log("   Selecting residence type...");
    await clickOption(page, lead.residence);
    await sleep(500);

    // --- Years at Address ---
    console.log("   Selecting years at address...");
    await clickOption(page, lead.yearsAtAddress);
    await sleep(500);

    // --- Date of Birth ---
    console.log("   Selecting DOB month...");
    try {
      await selectOption(page, 'select[name="dob_month"], select[name="dobMonth"], select[name="birth_month"]', lead.dobMonth);
    } catch {
      await clickOption(page, lead.dobMonth);
    }

    console.log("   Selecting DOB day...");
    try {
      await selectOption(page, 'select[name="dob_day"], select[name="dobDay"], select[name="birth_day"]', lead.dobDay);
    } catch {
      await fillField(page, 'input[name="dob_day"], input[name="dobDay"], input[name="birth_day"]', lead.dobDay);
    }

    console.log("   Selecting DOB year...");
    try {
      await selectOption(page, 'select[name="dob_year"], select[name="dobYear"], select[name="birth_year"]', lead.dobYear);
    } catch {
      await fillField(page, 'input[name="dob_year"], input[name="dobYear"], input[name="birth_year"]', lead.dobYear);
    }

    // --- Debt Questions ---
    console.log("   Answering credit card debt $10k+ question...");
    await clickOption(page, lead.creditCardDebt10k);
    await sleep(500);

    console.log("   Answering unsecured debt $10k+ question...");
    await clickOption(page, lead.unsecuredDebt10k);
    await sleep(500);

    console.log("   Answering monthly payment $250 question...");
    await clickOption(page, lead.monthlyPayment250);
    await sleep(500);

    // --- Has Car ---
    console.log("   Answering has car question...");
    await clickOption(page, lead.hasCar);
    await sleep(500);

    // --- Monthly Income ---
    console.log("   Selecting monthly income...");
    await clickOption(page, lead.monthlyIncome);
    await sleep(500);

    // --- Pay Frequency ---
    console.log("   Selecting pay frequency...");
    await clickOption(page, lead.payFrequency);
    await sleep(500);

    // --- Military ---
    console.log("   Answering military question...");
    await clickOption(page, lead.military);
    await sleep(500);

    // --- Income Source ---
    console.log("   Selecting income source...");
    await clickOption(page, lead.incomeSource);
    await sleep(500);

    // --- Employer ---
    console.log("   Filling employer...");
    await fillField(page, 'input[name="employer"], input[name="employerName"], input[placeholder*="Employer"]', lead.employer);

    // --- Time Employed ---
    console.log("   Selecting time employed...");
    await clickOption(page, lead.timeEmployed);
    await sleep(500);

    // --- Work Phone ---
    console.log("   Filling work phone...");
    await fillField(page, 'input[name="work_phone"], input[name="workPhone"], input[placeholder*="Work"]', lead.workPhone);

    // --- Driver License ---
    console.log("   Filling driver license...");
    await fillField(page, 'input[name="driver_license"], input[name="driverLicense"], input[name="dl_number"], input[placeholder*="License"]', lead.driverLicense);

    // --- License State ---
    console.log("   Selecting license state...");
    try {
      await selectOption(page, 'select[name="license_state"], select[name="licenseState"], select[name="dl_state"]', lead.licenseState);
    } catch {
      await clickOption(page, lead.licenseState);
    }

    // --- SSN ---
    console.log("   Filling SSN...");
    await fillField(page, 'input[name="ssn"], input[name="socialSecurity"], input[placeholder*="SSN"], input[placeholder*="Social"]', lead.ssn);

    // --- Bank Account Type ---
    console.log("   Selecting bank account type...");
    await clickOption(page, lead.bankAccountType);
    await sleep(500);

    // --- Direct Deposit ---
    console.log("   Answering direct deposit question...");
    await clickOption(page, lead.directDeposit);
    await sleep(500);

    // --- Account Length ---
    console.log("   Selecting account length...");
    await clickOption(page, lead.accountLength);
    await sleep(500);

    // --- Credit Score ---
    console.log("   Selecting credit score...");
    await clickOption(page, lead.creditScore);
    await sleep(500);

    // --- Loan Reason ---
    console.log("   Selecting loan reason...");
    await clickOption(page, lead.loanReason);
    await sleep(500);

    // --- Bank Name ---
    console.log("   Filling bank name...");
    await fillField(page, 'input[name="bank_name"], input[name="bankName"], input[placeholder*="Bank"]', lead.bankName);

    // --- Routing Number ---
    console.log("   Filling routing number...");
    await fillField(page, 'input[name="routing_number"], input[name="routingNumber"], input[name="aba"], input[placeholder*="Routing"]', lead.routingNumber);

    // --- Account Number ---
    console.log("   Filling account number...");
    await fillField(page, 'input[name="account_number"], input[name="accountNumber"], input[placeholder*="Account"]', lead.accountNumber);

    console.log("   Form filling complete!");

    // Step 4: Take screenshot (DO NOT click submit)
    console.log("[5/5] Taking screenshot of filled form...");
    const screenshotPath = path.join(screenshotsDir, "test_filled.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   Screenshot saved to: ${screenshotPath}`);

    // Step 5: Wait 30 seconds so we can review the form
    console.log("   Waiting 30 seconds for manual review...");
    await sleep(30000);
    console.log("   Done! Closing browser.");
  } catch (error) {
    console.error("Error during form filling:", error);
    // Take error screenshot
    const errorScreenshotPath = path.join(screenshotsDir, "error.png");
    await page.screenshot({ path: errorScreenshotPath, fullPage: true }).catch(() => {});
    console.error(`   Error screenshot saved to: ${errorScreenshotPath}`);
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
