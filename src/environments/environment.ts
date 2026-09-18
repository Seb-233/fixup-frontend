// Configuración de entorno de desarrollo
// AVISO: Los valores de Auth0 son plantillas de desarrollo (placeholders).
// La integración funcional requiere un tenant real configurado fuera del repositorio.

export const environment = {
  production: false,
  apiOrigin: 'http://localhost:8081',
 auth0: {
    domain: 'dev-uzssz142azr2k5hv.us.auth0.com',
    clientId: 'mh6MMduxMTnL2EbEKdSSqp1FM8Ah7105',
    authorizationParams: {
      audience: 'urn:fixup:api',
      redirect_uri: 'http://localhost:4200'
    }
  }
};