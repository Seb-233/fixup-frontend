// Configuración de entorno de desarrollo
// AVISO: Los valores de Auth0 son plantillas de desarrollo (placeholders).
// La integración funcional requiere un tenant real configurado fuera del repositorio.

export const environment = {
  production: false,
  apiOrigin: 'http://localhost:8081',
  auth0: {
    domain: 'example.auth0.com',
    clientId: 'example-client-id',
    audience: 'https://api.example.com'
  }
};
