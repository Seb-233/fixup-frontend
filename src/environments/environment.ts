// Configuración de entorno de desarrollo
// AVISO: Los valores de Auth0 son credenciales públicas del tenant en Auth0 para la SPA.

export const environment = {
  production: false,
  apiOrigin: 'http://localhost:8080',
  auth0: {
    domain: 'dev-uzssz142azr2k5hv.us.auth0.com',
    clientId: 'mh6MMduxMTnL2EbEKdSSqp1FM8Ah7105',
    audience: 'urn:fixup:api'
  }
};