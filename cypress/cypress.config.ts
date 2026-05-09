import { defineConfig } from 'cypress'

export default defineConfig({
  defaultCommandTimeout: 60000,
  requestTimeout: 60000,
  responseTimeout: 60000,
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/results/screenshots',
    videosFolder: 'cypress/results/videos',
    video: true,
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      return config
    }
  },
  reporter: 'junit',
  reporterOptions: {
    mochaFile: 'cypress/results/junit/results-[hash].xml',
    toConsole: false
  }
})
