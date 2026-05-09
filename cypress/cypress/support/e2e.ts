import './commands'

// You can add global configuration and behavior that modifies Cypress here.
// For example, custom commands or global configuration values.

Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore uncaught exceptions from the app under test if necessary.
  return false
})
