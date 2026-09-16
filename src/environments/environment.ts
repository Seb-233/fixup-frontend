// Default development environment configuration (Placeholders only)
// NEVER commit real credentials, secrets, or tokens to version control.

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api/v1',
  auth0: {
    domain: 'example.auth0.com',
    clientId: 'example-client-id',
    audience: 'https://api.example.com'
  }
};
