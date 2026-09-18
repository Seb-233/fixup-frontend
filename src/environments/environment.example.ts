// Plantilla de configuración de entorno (Placeholders)
// NUNCA incluir secretos ni tokens reales en control de versiones.

export const environmentExample = {
  production: false,
  apiOrigin: 'http://localhost:8081',
  auth0: {
    domain: 'example.auth0.com',
    clientId: 'example-client-id',
    authorizationParams: {
      audience: 'https://api.example.com',
      redirect_uri: 'http://localhost:4200'
    }
  }
};
