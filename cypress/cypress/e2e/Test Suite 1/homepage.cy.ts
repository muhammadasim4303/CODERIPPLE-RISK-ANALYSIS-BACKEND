describe('CodeRipple homepage', () => {
  it('loads the app and shows expected elements', () => {
    cy.visit('/')
    cy.contains('CodeRipple').should('exist')
  })
})
