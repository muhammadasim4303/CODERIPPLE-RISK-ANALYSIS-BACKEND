# Cypress Test Environment for CodeRipple

This folder contains a standalone Cypress environment for end-to-end testing.

## Setup

1. Open a terminal in the `cypress` folder:
   ```powershell
   cd "c:\Users\DELL\Desktop\CodeRipple Version 1.0\CodeRipple\cypress"
   npm install
   ```

2. Start the frontend app from the main repo root in a separate terminal:
   ```powershell
   cd "c:\Users\DELL\Desktop\CodeRipple Version 1.0\CodeRipple\frontend"
   npm install
   npm run dev
   ```

3. Run Cypress:
   - Open interactive test runner:
     ```powershell
     npm run open
     ```
   - Run headless tests and save results:
     ```powershell
     npm run run
     ```

## Test files

Test cases live in `cypress/e2e/`.

## Results

Test artifacts are saved to:
- `cypress/results/junit/` for XML reports
- `cypress/results/screenshots/` for screenshots
- `cypress/results/videos/` for videos if enabled

## Test Suite Location

The auth tests are located in:
- `cypress/cypress/e2e/Test Suite 1/auth.cy.ts`

## Notes

The Cypress base URL is set to `http://localhost:5173`.
Adjust `cypress.config.ts` if your frontend uses a different dev server port.
