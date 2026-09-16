# Arquitectura del Frontend — FixUp

Este documento detalla la arquitectura técnica, los principios de diseño y los patrones organizacionales establecidos para la plataforma frontend unificada de FixUp.

---

## 🏛️ Principios Fundamentales

1. **Código Único Multiplataforma**: Una única base de código frontend en Angular sirve a tres objetivos:
   - Aplicación Web Responsive (Escritorio, Tablet y Móvil).
   - Progressive Web App (PWA) instalable en el navegador.
   - Aplicación híbrida para Android mediante Capacitor (sin desarrollo nativo en Kotlin ni iOS).
2. **Componentes Standalone**: Se utiliza la arquitectura moderna de Angular Standalone sin NgModules tradicionales, optimizando la modularidad y el empaquetado (tree-shaking).
3. **Manejo de Estado con Signals y RxJS**: Se priorizan Angular Signals para el estado síncrono y reactivo de la interfaz, combinados con RxJS para operaciones asíncronas y flujos de eventos HTTP.
4. **Desacoplamiento Estricto**: La lógica de presentación está separada de los servicios de acceso a datos y las reglas de negocio.

---

## 📂 Organización por Capas y Carpetas

La aplicación sigue una arquitectura modular en capas con responsabilidades delimitadas:

### 1. `src/app/core/` (Transversal Global)
Contiene servicios singleton, configuraciones globales y utilidades transversales que solo se instancian una vez en toda la aplicación:
- **`auth/`**: Adaptadores y servicios para Auth0, guards de autenticación y autorización por roles, interceptores de seguridad y el store reactivo del usuario actual (`CurrentUserStore`).
- **`config/`**: Configuración de runtime y parámetros globales del sistema.
- **`guards/`**: Guards funcionales de enrutamiento aplicables globalmente.
- **`interceptors/`**: Interceptores HTTP funcionales para telemetría, auditoría y manejo transversal de peticiones.
- **`errors/`**: Manejo centralizado de errores globales y logging.
- **`services/`**: Servicios transversales que no pertenecen al dominio de una feature específica.

### 2. `src/app/layout/` (Estructura Visual y Navegación)
Define los contenedores estructurales de la aplicación:
- **`desktop-shell/`**: Shell visual para pantallas de escritorio, integrando la barra superior y la navegación lateral fija.
- **`mobile-shell/`**: Shell visual para dispositivos móviles y la aplicación Capacitor, integrando la navegación inferior fija (`bottom-navigation`) y el encabezado móvil.
- **`topbar/`, `sidebar/`, `bottom-navigation/`**: Componentes visuales de navegación global.

### 3. `src/app/shared/` (Reutilizable sin Negocio)
Elementos visuales y lógicos transversales puramente reutilizables:
- **`components/`**: Componentes presentacionales sin lógica de negocio ni llamadas HTTP directas.
- **`directives/`**: Directivas de comportamiento reutilizables.
- **`models/`**: Interfaces genéricas del frontend y contratos no atados a una feature exclusiva.
- **`pipes/`**: Transformadores visuales de datos.
- **`validators/`**: Validadores para Reactive Forms.
- **`utilities/`**: Funciones puras de utilidad específicas (sin agrupar funciones no relacionadas en archivos genéricos).

### 4. `src/app/api/` (Acceso a Datos y Clientes Generados)
- **`generated/`**: Espacio reservado para los modelos y clientes API generados automáticamente a partir de especificaciones OpenAPI del backend de FixUp.
- Los componentes nunca consumen `HttpClient` directamente; toda interacción HTTP se encapsula en servicios dedicados de acceso a datos.

### 5. `src/app/features/` (Módulos por Dominio de Negocio)
Cada funcionalidad se aísla en su propio dominio. Una feature no debe importar ni acceder a archivos internos de otra feature:
- `authentication/`: Vistas y flujos de autenticación e incorporación.
- `dashboard/`: Paneles y métricas principales por perfil de usuario.
- `properties/`: Gestión de inmuebles y residencias.
- `fixers/`: Directorio, perfiles y valoraciones de técnicos especializados.
- `requests/`: Creación y seguimiento de solicitudes de reparación.
- `quotations/`: Presupuestos, comparativas y aprobaciones.
- `jobs/`: Gestión operativa de servicios en ejecución.
- `notifications/`: Notificaciones en tiempo real del sistema.
- `messaging/`: Comunicación entre clientes y técnicos.
- `payments/`: Procesamiento y estados de transacciones de pago.
- `contracts/`: Acuerdos y condiciones de servicio.
- `analytics/`: Reportes e inteligencia de negocio.
- `administration/`: Gestión de usuarios, catálogos y gobernanza.

---

## 📱 Tecnologías Integradas

### Ionic Angular
- Utilizado como librería de componentes UI optimizados para interfaces móviles (gestos, botones, modales, listas y navegación móvil).
- Se integra en modo standalone vía `provideIonicAngular({})`.

### Progressive Web App (PWA)
- Implementada mediante `@angular/service-worker` con configuración explícita en `ngsw-config.json`.
- Manifiesto web en `src/manifest.webmanifest`.
- El Service Worker se encuentra condicionado para activarse únicamente en entornos de producción (`!isDevMode()`).

### Capacitor Android
- Contenedor nativo configurado en `capacitor.config.ts` con ID `com.fixup.app`.
- El directorio `android/` forma parte del repositorio como contenedor puente nativo, pero excluye configuraciones locales (`local.properties`), llaves de firma y artefactos de compilación (`build/`, `*.apk`).
- No se incorporan pantallas en Kotlin ni configuraciones de la plataforma iOS.

### Autenticación con Auth0
- Arquitectura desacoplada mediante `@auth0/auth0-angular`.
- La aplicación frontend actúa como cliente público (SPA): bajo ninguna circunstancia contiene `Client Secret`, `Management API Token` ni contraseñas.
- El interceptor `auth.interceptor.ts` delega el Bearer Token de manera restringida únicamente a las peticiones dirigidas a `environment.apiBaseUrl`, previniendo fugas de tokens a terceros.

### Adaptabilidad Responsive
- El diseño responde automáticamente al dispositivo del usuario mediante variables y mixins SCSS en `src/styles/` y detección reactiva de pantalla en `AppComponent`, renderizando el shell de escritorio o móvil según corresponda sin duplicar salidas del enrutador (`RouterOutlet`).
