# WorkTonix - Browser Automation

Browser automation project using Playwright + AdsPower for form filling.

## Prerequisites

- Node.js 18+
- AdsPower browser with a configured profile
- A running AdsPower local API on `http://local.adspower.net:50325`

## Setup

```bash
npm install
```

## Configuration

Set your AdsPower profile ID either via environment variable or `.env` file:

```bash
# .env
ADSPOWER_PROFILE_ID=your_profile_id_here
```

Or edit the `PROFILE_ID` constant directly in `src/test-form.ts`.

## Run

```bash
npx ts-node src/test-form.ts
```

The script will:
1. Connect to AdsPower and launch the browser profile
2. Navigate to the target form
3. Fill all fields with test lead data
4. Take a screenshot at `screenshots/test_filled.png`
5. Wait 30 seconds for manual review, then close
