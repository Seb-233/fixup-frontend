// Configuración de entorno de desarrollo
// AVISO: Los valores de Auth0 son credenciales públicas del tenant en Auth0 para la SPA.

export const environment = {
  production: false,
  apiOrigin: '',
  // Muestra el acceso con cuentas de demostración cuando el backend corre con el perfil demo
  // (GET /demo/token). Con cualquier otro perfil el endpoint no responde y el acceso no aparece.
  demoLogin: true,
  auth0: {
    domain: 'dev-uzssz142azr2k5hv.us.auth0.com',
    clientId: 'mh6MMduxMTnL2EbEKdSSqp1FM8Ah7105',
    audience: 'urn:fixup:api'
  },
  native: {
    // FR-UC-21: debe coincidir con appId en capacitor.config.ts y con el esquema declarado
    // en el intent-filter de AndroidManifest.xml.
    appId: 'com.fixup.app'
  },
  map: {
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }
};