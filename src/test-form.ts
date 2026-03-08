import { chromium, Browser, Page } from "playwright";
import axios from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const ADSPOWER_API = "http://local.adspower.net:50325";
const PROFILE_ID = process.env.ADSPOWER_PROFILE_ID || "YOUR_PROFILE_ID";
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
  creditCardDebt10k: "No",
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
  await page.waitForSelector(selector, { timeout: 30000 });
  await page.click(selector);
  await page.fill(selector, value);
  console.log("✓ Filled: " + label);
}

async function clickByText(
  page: Page,
  text: string,
  label: string
): Promise<void> {
  const sel = 'text="' + text + '"';
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.click(sel);
  console.log("✓ Clicked: " + label);
  await sleep(1000);
}

async function selectDropdown(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  await page.waitForSelector(selector, { timeout: 30000 });
  await page.selectOption(selector, { label: value });
  console.log("✓ Selected: " + label);
}

async function clickNext(page: Page, label: string = "Next"): Promise<void> {
  const nextSelectors = [
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'input[type="submit"][value*="Next"]',
    'a:has-text("Next")',
    'button[type="submit"]',
  ];

  for (const sel of nextSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      await page.click(sel);
      console.log("✓ Clicked: " + label);
      await sleep(3000);
      return;
    } catch {
      continue;
    }
  }
  console.log("⚠ No Next button found, continuing...");
}

// ── AdsPower connection ─────────────────────────────────────────
async function connectAdsPower(): Promise<string> {
  console.log("Starting AdsPower browser for profile: " + PROFILE_ID);

  const response = await axios.get(ADSPOWER_API + "/api/v1/browser/start", {
    params: { user_id: PROFILE_ID },
  });

  const data = response.data;
  if (data.code !== 0) {
    throw new Error("AdsPower API error: " + data.msg);
  }

  const wsUrl: string = data.data.ws?.puppeteer || data.data.ws;
  if (!wsUrl) {
    throw new Error("No websocket URL returned from AdsPower");
  }

  console.log("✓ Got WebSocket endpoint: " + wsUrl);
  return wsUrl;
}

// ── Main ────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const screenshotsDir = path.join(__dirname, "..", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Step 1 - Connect to AdsPower
  const wsEndpoint = await connectAdsPower();

  console.log("Connecting Playwright to AdsPower browser...");
  const browser: Browser = await chromium.connectOverCDP(wsEndpoint, {
    slowMo: 800,
  });

  const context = browser.contexts()[0];
  const page: Page = context?.pages()[0] || (await context.newPage());

  const clickLabel = async (text: string, lbl: string) => {
    try {
      await page.locator('span.label-bg').filter({ hasText: text }).first().click();
      console.log('Label clicked:', lbl);
      await sleep(2000);
    } catch(e) {
      try {
        await page.locator('label').filter({ has: page.locator('span.label-bg', { hasText: text }) }).first().click();
        console.log('Label clicked fallback:', lbl);
        await sleep(2000);
      } catch(e2) {
        console.log('Skip label:', lbl);
      }
    }
  };

  const fill = async (selector: string, value: string, label: string) => {
    await fillInput(page, selector, value, label);
  };

  const next = async () => {
    await clickNext(page);
  };

  try {
    // Step 2 - Navigate to target URL
    console.log("Navigating to " + TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    console.log("✓ Page loaded");
    await sleep(3000);

    // Step 3 - Fill the form
    console.log("Filling form fields...");

    // Loan Amount (radio/button)
    await clickByText(page, lead.loanAmount, "Loan Amount");

    // Personal Info
    await fillInput(
      page,
      'input[name="first_name"], input[name="firstName"], input[placeholder*="First"]',
      lead.firstName,
      "First Name"
    );
    await fillInput(
      page,
      'input[name="last_name"], input[name="lastName"], input[placeholder*="Last"]',
      lead.lastName,
      "Last Name"
    );
    await fillInput(
      page,
      'input[name="email"], input[type="email"], input[placeholder*="Email"]',
      lead.email,
      "Email"
    );
    await fillInput(
      page,
      'input[name="phone"], input[type="tel"], input[placeholder*="Phone"]',
      lead.phone,
      "Phone"
    );

    // Contact Time
    await clickByText(page, lead.contactTime, "Contact Time");

    // Address
    await fillInput(
      page,
      'input[name="zip"], input[name="zipCode"], input[placeholder*="Zip"]',
      lead.zip,
      "Zip"
    );
    await fillInput(
      page,
      'input[name="address"], input[name="street"], input[placeholder*="Address"]',
      lead.address,
      "Address"
    );
    await fillInput(
      page,
      'input[name="city"], input[placeholder*="City"]',
      lead.city,
      "City"
    );

    // State (try dropdown first, fall back to text click)
    try {
      await selectDropdown(
        page,
        'select[name="state"]',
        lead.state,
        "State"
      );
    } catch {
      await clickByText(page, lead.state, "State");
    }

    // Home ownership
    await clickByText(page, lead.homeOwner, "Home Owner");
    await clickByText(page, lead.yearsAtAddress, "Years at Address");

    // Date of Birth
    try {
      await selectDropdown(
        page,
        'select[name="dob_month"], select[name="dobMonth"], select[name="birth_month"]',
        lead.dobMonth,
        "DOB Month"
      );
    } catch {
      await clickByText(page, lead.dobMonth, "DOB Month");
    }

    try {
      await selectDropdown(
        page,
        'select[name="dob_day"], select[name="dobDay"], select[name="birth_day"]',
        lead.dobDay,
        "DOB Day"
      );
    } catch {
      await fillInput(
        page,
        'input[name="dob_day"], input[name="dobDay"], input[name="birth_day"]',
        lead.dobDay,
        "DOB Day"
      );
    }

    try {
      await selectDropdown(
        page,
        'select[name="dob_year"], select[name="dobYear"], select[name="birth_year"]',
        lead.dobYear,
        "DOB Year"
      );
    } catch {
      await fillInput(
        page,
        'input[name="dob_year"], input[name="dobYear"], input[name="birth_year"]',
        lead.dobYear,
        "DOB Year"
      );
    }

    // Debt questions (using clickLabel for span.label-bg radio buttons)
    await clickLabel(lead.creditCardDebt10k, "Credit Card Debt 10k+");
    await clickLabel(lead.unsecuredDebt10k, "Unsecured Debt 10k+");
    await clickLabel(lead.monthlyPayment250, "Monthly Payment $250");
    await clickLabel(lead.hasCar, "Has Car");

    // Income field + advance
    await fill('input[name="income"]', '3500', 'Income');
    await next();

    // Income
    await clickByText(page, lead.monthlyIncome, "Monthly Income");
    await clickByText(page, lead.payFrequency, "Pay Frequency");
    await clickByText(page, lead.military, "Military");
    await clickByText(page, lead.incomeSource, "Income Source");

    // Employment
    await fillInput(
      page,
      'input[name="employer"], input[name="employerName"], input[placeholder*="Employer"]',
      lead.employer,
      "Employer"
    );
    await clickByText(page, lead.timeEmployed, "Time Employed");
    await fillInput(
      page,
      'input[name="work_phone"], input[name="workPhone"], input[placeholder*="Work"]',
      lead.workPhone,
      "Work Phone"
    );

    // Identity
    await fillInput(
      page,
      'input[name="driver_license"], input[name="driverLicense"], input[name="dl_number"], input[placeholder*="License"]',
      lead.driversLicense,
      "Drivers License"
    );

    try {
      await selectDropdown(
        page,
        'select[name="license_state"], select[name="licenseState"], select[name="dl_state"]',
        lead.licenseState,
        "License State"
      );
    } catch {
      await clickByText(page, lead.licenseState, "License State");
    }

    await fillInput(
      page,
      'input[name="ssn"], input[name="socialSecurity"], input[placeholder*="SSN"], input[placeholder*="Social"]',
      lead.ssn,
      "SSN"
    );

    // Banking
    await clickByText(page, lead.bankAccountType, "Bank Account Type");
    await clickByText(page, lead.directDeposit, "Direct Deposit");
    await clickByText(page, lead.accountLength, "Account Length");
    await clickByText(page, lead.creditScore, "Credit Score");
    await clickByText(page, lead.loanReason, "Loan Reason");

    await fillInput(
      page,
      'input[name="bank_name"], input[name="bankName"], input[placeholder*="Bank"]',
      lead.bankName,
      "Bank Name"
    );
    await fillInput(
      page,
      'input[name="routing_number"], input[name="routingNumber"], input[name="aba"], input[placeholder*="Routing"]',
      lead.routingNumber,
      "Routing Number"
    );
    await fillInput(
      page,
      'input[name="account_number"], input[name="accountNumber"], input[placeholder*="Account"]',
      lead.accountNumber,
      "Account Number"
    );

    console.log("All fields filled successfully!");

    // Step 4 - Screenshot (DO NOT click submit)
    console.log("Taking screenshot...");
    const screenshotPath = path.join(screenshotsDir, "test_filled.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("✓ Screenshot saved: " + screenshotPath);

    // Step 5 - Wait 30 seconds then close
    console.log("Waiting 30 seconds for manual review...");
    await sleep(30000);
    console.log("✓ Review period complete. Closing browser.");
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
