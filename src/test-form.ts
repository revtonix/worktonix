import { chromium, Browser, Page } from "playwright";
import axios from "axios";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const ADSPOWER_API = "http://local.adspower.net:50325";
const PROFILE_ID = process.env.ADSPOWER_PROFILE_ID || "YOUR_PROFILE_ID";
const TARGET_URL = "https://www.unitedemergencyrelief.com/";

// -- Test lead data --
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

// -- Helpers --
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stepNum = 0;

async function takeScreenshot(page: Page, label: string): Promise<void> {
  stepNum++;
  const screenshotsDir = path.join(__dirname, "..", "screenshots");
  const filePath = path.join(screenshotsDir, `step${stepNum}.png`);
  await page.screenshot({ path: filePath });
  console.log(`Step done. URL: ${page.url()}`);
  console.log(`Screenshot saved: ${filePath} (${label})`);
}

async function fillInput(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  const loc = page.locator(selector).and(page.locator(":visible")).first();
  await loc.waitFor({ state: "visible", timeout: 8000 });
  await loc.click();
  await loc.fill(value);
  console.log("Filled: " + label);
}

async function clickRadio(
  page: Page,
  text: string,
  label: string
): Promise<void> {
  await page.locator("span.label-bg").filter({ hasText: text }).first().click();
  await sleep(2000);
  console.log("Clicked radio: " + label + " = " + text);
}

async function selectDropdown(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  const loc = page.locator(selector).and(page.locator(":visible")).first();
  await loc.waitFor({ state: "visible", timeout: 8000 });
  await loc.selectOption({ label: value });
  console.log("Selected: " + label);
}

// -- AdsPower connection --
async function connectAdsPower(): Promise<string> {
  console.log("Starting AdsPower browser for profile: " + PROFILE_ID);

  const response = await axios.get(ADSPOWER_API + "/api/v1/browser/start", {
    params: { user_id: PROFILE_ID },
    proxy: false,
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

// -- Main --
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

  try {
    // Step 2 - Navigate to target URL
    console.log("Navigating to " + TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });
    console.log("Page loaded");
    await sleep(2000);
    await takeScreenshot(page, "page loaded");

    // Step 3 - Fill the multi-step form
    console.log("Filling form fields...");

    // -- Loan Amount (radio) --
    await clickRadio(page, lead.loanAmount, "Loan Amount");
    await takeScreenshot(page, "loan amount");

    // -- Personal Info --
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
    await takeScreenshot(page, "personal info");

    // -- Contact Time (radio) --
    await clickRadio(page, lead.contactTime, "Contact Time");
    await takeScreenshot(page, "contact time");

    // -- Address --
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
    await takeScreenshot(page, "address fields");

    // -- State (dropdown or radio) --
    try {
      await selectDropdown(page, 'select[name="state"]', lead.state, "State");
    } catch {
      await clickRadio(page, lead.state, "State");
    }
    await takeScreenshot(page, "state");

    // -- Home ownership (radio) --
    await clickRadio(page, lead.homeOwner, "Home Owner");
    await takeScreenshot(page, "home owner");

    // -- Years at Address (radio) --
    await clickRadio(page, lead.yearsAtAddress, "Years at Address");
    await takeScreenshot(page, "years at address");

    // -- Date of Birth --
    try {
      await selectDropdown(
        page,
        'select[name="dob_month"], select[name="dobMonth"], select[name="birth_month"]',
        lead.dobMonth,
        "DOB Month"
      );
    } catch {
      await clickRadio(page, lead.dobMonth, "DOB Month");
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
    await takeScreenshot(page, "dob");

    // -- Credit Card Debt 10k+ (radio) --
    await clickRadio(page, lead.creditCardDebt10k, "Credit Card Debt 10k+");
    await takeScreenshot(page, "credit card debt");

    // -- Unsecured Debt 10k+ (radio) --
    await clickRadio(page, lead.unsecuredDebt10k, "Unsecured Debt 10k+");
    await takeScreenshot(page, "unsecured debt");

    // -- Monthly Payment $250 (radio) --
    await clickRadio(page, lead.monthlyPayment250, "Monthly Payment $250");
    await takeScreenshot(page, "monthly payment");

    // -- Has Car (radio) --
    await clickRadio(page, lead.hasCar, "Has Car");
    await takeScreenshot(page, "has car");

    // -- Monthly Income (radio) --
    await clickRadio(page, lead.monthlyIncome, "Monthly Income");
    await takeScreenshot(page, "monthly income");

    // -- Pay Frequency (radio) --
    await clickRadio(page, lead.payFrequency, "Pay Frequency");
    await takeScreenshot(page, "pay frequency");

    // -- Military (radio) --
    await clickRadio(page, lead.military, "Military");
    await takeScreenshot(page, "military");

    // -- Income Source (radio) --
    await clickRadio(page, lead.incomeSource, "Income Source");
    await takeScreenshot(page, "income source");

    // -- Employment --
    await fillInput(
      page,
      'input[name="employer"], input[name="employerName"], input[placeholder*="Employer"]',
      lead.employer,
      "Employer"
    );
    await takeScreenshot(page, "employer");

    // -- Time Employed (radio) --
    await clickRadio(page, lead.timeEmployed, "Time Employed");
    await takeScreenshot(page, "time employed");

    // -- Work Phone --
    await fillInput(
      page,
      'input[name="work_phone"], input[name="workPhone"], input[placeholder*="Work"]',
      lead.workPhone,
      "Work Phone"
    );
    await takeScreenshot(page, "work phone");

    // -- Drivers License --
    await fillInput(
      page,
      'input[name="driver_license"], input[name="driverLicense"], input[name="dl_number"], input[placeholder*="License"]',
      lead.driversLicense,
      "Drivers License"
    );
    await takeScreenshot(page, "drivers license");

    // -- License State --
    try {
      await selectDropdown(
        page,
        'select[name="license_state"], select[name="licenseState"], select[name="dl_state"]',
        lead.licenseState,
        "License State"
      );
    } catch {
      await clickRadio(page, lead.licenseState, "License State");
    }
    await takeScreenshot(page, "license state");

    // -- SSN --
    await fillInput(
      page,
      'input[name="ssn"], input[name="socialSecurity"], input[placeholder*="SSN"], input[placeholder*="Social"]',
      lead.ssn,
      "SSN"
    );
    await takeScreenshot(page, "ssn");

    // -- Bank Account Type (radio) --
    await clickRadio(page, lead.bankAccountType, "Bank Account Type");
    await takeScreenshot(page, "bank account type");

    // -- Direct Deposit (radio) --
    await clickRadio(page, lead.directDeposit, "Direct Deposit");
    await takeScreenshot(page, "direct deposit");

    // -- Account Length (radio) --
    await clickRadio(page, lead.accountLength, "Account Length");
    await takeScreenshot(page, "account length");

    // -- Credit Score (radio) --
    await clickRadio(page, lead.creditScore, "Credit Score");
    await takeScreenshot(page, "credit score");

    // -- Loan Reason (radio) --
    await clickRadio(page, lead.loanReason, "Loan Reason");
    await takeScreenshot(page, "loan reason");

    // -- Bank Name --
    await fillInput(
      page,
      'input[name="bank_name"], input[name="bankName"], input[placeholder*="Bank"]',
      lead.bankName,
      "Bank Name"
    );
    await takeScreenshot(page, "bank name");

    // -- Routing Number --
    await fillInput(
      page,
      'input[name="routing_number"], input[name="routingNumber"], input[name="aba"], input[placeholder*="Routing"]',
      lead.routingNumber,
      "Routing Number"
    );
    await takeScreenshot(page, "routing number");

    // -- Account Number --
    await fillInput(
      page,
      'input[name="account_number"], input[name="accountNumber"], input[placeholder*="Account"]',
      lead.accountNumber,
      "Account Number"
    );
    await takeScreenshot(page, "account number");

    console.log("All fields filled successfully!");
    console.log("DONE! Screenshot saved");
    await takeScreenshot(page, "DONE");

    // Wait for review
    await sleep(15000);
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
