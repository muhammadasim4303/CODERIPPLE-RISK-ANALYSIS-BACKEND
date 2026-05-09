describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('displays the login form by default', () => {
    cy.get('h1').contains('CodeRipple')
    cy.get('button[role="tab"]').contains('Sign In').should('have.attr', 'aria-selected', 'true')
    cy.get('input[name="email"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
    cy.get('button[type="submit"]').contains('Sign In').should('be.visible')
  })

  it('shows validation errors on empty login submission', () => {
    cy.get('button[type="submit"]').contains('Sign In').click()
    cy.contains('Email is required').should('be.visible')
    cy.contains('Password is required').should('be.visible')
  })

  it('shows validation errors for invalid email', () => {
    cy.get('input[name="email"]').type('invalid-email')
    cy.get('button[type="submit"]').contains('Sign In').click()
    cy.contains('Invalid email').should('be.visible')
  })

  it('switches to signup tab and displays signup fields', () => {
    cy.get('button[role="tab"]').contains('Sign Up').click()
    cy.get('input[name="username"]').should('be.visible')
    cy.get('input[name="email"]').should('be.visible')
    cy.get('input[name="password"]').should('have.length', 2) // Password and Confirm Password inputs may share the identical name or different. Wait, looking at the code, it's 'password' and 'confirmPassword'.
    
    cy.get('input[name="password"]').should('be.visible')
    cy.get('input[name="confirmPassword"]').should('be.visible')
    cy.get('button[type="submit"]').contains('Create Account').should('be.visible')
  })

  it('shows validation errors on empty signup submission', () => {
    cy.get('button[role="tab"]').contains('Sign Up').click()
    cy.get('button[type="submit"]').contains('Create Account').click()
    cy.contains('Email is required').should('be.visible')
    cy.contains('Password is required').should('be.visible')
    cy.contains('Min 3 characters').should('be.visible') // username
  })

  it('shows error if passwords do not match', () => {
    cy.get('button[role="tab"]').contains('Sign Up').click()
    cy.get('input[name="username"]').type('testuser')
    cy.get('input[name="email"]').type('test@example.com')
    cy.get('input[name="password"]').type('password123')
    cy.get('input[name="confirmPassword"]').type('differentpassword')
    cy.get('button[type="submit"]').contains('Create Account').click()
    cy.contains('Passwords do not match').should('be.visible')
  })

  it('allows toggling password visibility', () => {
    cy.get('input[name="password"]').should('have.attr', 'type', 'password')
    // Click the eye icon
    cy.get('input[name="password"]').parent().find('button').click()
    cy.get('input[name="password"]').should('have.attr', 'type', 'text')
  })
})
