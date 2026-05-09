describe('Protected Routes', () => {
  const protectedRoutes = [
    '/dashboard',
    '/repos',
    '/change-impact',
    '/risk-overview',
    '/settings'
  ]

  protectedRoutes.forEach((route) => {
    it(`redirects ${route} to login when not authenticated`, () => {
      // Visiting a protected route without auth should redirect to /login
      cy.visit(route)
      cy.url().should('include', '/login')
    })
  })

  it('redirects root (/) to login when not authenticated', () => {
    cy.visit('/')
    cy.url().should('include', '/login')
  })
})
