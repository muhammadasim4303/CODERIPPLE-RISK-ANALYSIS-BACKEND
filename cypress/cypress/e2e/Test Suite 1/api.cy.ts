describe('Backend API Tests', () => {
  const apiUrl = 'http://localhost:5000/api'

  it('checks the health of the backend application', () => {
    cy.request('GET', `${apiUrl}/health`).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'ok')
      expect(response.body).to.have.property('timestamp')
    })
  })

  it('returns 400 for empty body on /analyze endpoint', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/analyze`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400)
      expect(response.body).to.have.property('error')
    })
  })

  it('analyzes a trivial commit successfully', () => {
    const payload = {
      sha: '1234567890abcdef',
      repo: 'test/repo',
      patch: '--- a/file.txt\n+++ b/file.txt\n@@ -1,1 +1,1 @@\n-old\n+new'
    }

    cy.request({
      method: 'POST',
      url: `${apiUrl}/analyze`,
      body: payload
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('sha', '1234567890abcdef')
      expect(response.body).to.have.property('risk_score')
      expect(response.body).to.have.property('risk_label')
      expect(response.body).to.have.property('probabilities')
    })
  })

  it('analyzes a batch commit successfully', () => {
    const payload = {
      sha: 'abcdef1234567890',
      repo: 'test/repo',
      description: 'Test commit',
      files: [
        {
          filename: 'test.py',
          patch: '--- a/test.py\n+++ b/test.py\n@@ -1,1 +1,1 @@\n-pass\n+print("hello")'
        }
      ]
    }

    cy.request({
      method: 'POST',
      url: `${apiUrl}/analyze/batch`,
      body: payload
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('sha', 'abcdef1234567890')
      expect(response.body).to.have.property('risk_score')
      expect(response.body).to.have.property('risk_label')
      expect(response.body).to.have.property('per_file')
      expect(response.body.per_file).to.be.an('array').that.is.not.empty
    })
  })

  it('manages risk cache appropriately', () => {
    const sha = 'test-cache-sha'
    const cacheData = { risk_score: 0.5, risk_label: 'MEDIUM RISK' }

    // 1. Post to cache
    cy.request({
      method: 'POST',
      url: `${apiUrl}/commit/${sha}/risk`,
      body: cacheData
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'cached')
    })

    // 2. Get from cache
    cy.request({
      method: 'GET',
      url: `${apiUrl}/commit/${sha}/risk`
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('risk_score', 0.5)
      expect(response.body).to.have.property('risk_label', 'MEDIUM RISK')
    })

    // 3. Delete from cache
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/commit/${sha}/risk`
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'deleted')
    })

    // 4. Verify deletion
    cy.request({
      method: 'GET',
      url: `${apiUrl}/commit/${sha}/risk`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404)
    })
  })
})
