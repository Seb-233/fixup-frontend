// Plantilla de configuración de entorno (Placeholders)
// NUNCA incluir secretos ni tokens reales en control de versiones.

export const environmentExample = {
  production: false,
  apiOrigin: 'http://localhost:8080',
  auth0: {
    domain: 'your-tenant.us.auth0.com',
    clientId: 'your-client-id',
    audience: 'urn:fixup:api'
  }
};
