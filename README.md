# FixUp Frontend

Plataforma frontend unificada para el ecosistema **FixUp**. Diseñada con una arquitectura responsive en **Angular Standalone**, orientada a servir como aplicación web de escritorio y móvil, Progressive Web App (PWA) instalable y aplicación empaquetada para dispositivos Android mediante Capacitor.

---

## 1. Descripción del Proyecto

FixUp es una plataforma integral orientada a conectar propietarios, residentes y administradores de inmuebles con técnicos y profesionales especializados en reparaciones, mantenimiento preventivo y adecuaciones del hogar y comercio. Este repositorio contiene el código fuente de la interfaz de usuario y las capas de presentación de la plataforma.

---

## 2. Alcance del Frontend

El frontend de FixUp abarca:
- **Aplicación Web Responsive**: Interfaz adaptativa optimizada tanto para pantallas de escritorio como para navegadores móviles.
- **PWA (Progressive Web App)**: Experiencia web progresiva con capacidad de instalación en dispositivos compatibles y soporte offline con Service Worker.
- **Aplicación híbrida para Android mediante Capacitor**: Empaquetado como contenedor nativo Android sin código de pantallas Kotlin ni soporte para iOS.
- **Consumo de API REST**: Comunicación con backend modular mediante API REST autenticado mediante Auth0.

---

## 3. Arquitectura

La base de código sigue un patrón modular desacoplado en capas:
- **`core/`**: Servicios transversales, adaptadores de autenticación Auth0, configuración global, interceptores y manejo de errores.
- **`layout/`**: Shells responsive (`desktop-shell`, `mobile-shell`), barra superior, barra lateral y navegación inferior.
- **`shared/`**: Componentes visuales reutilizables sin lógica de negocio, directivas, pipes, modelos genéricos y validadores.
- **`api/`**: Clientes generados a partir de especificaciones OpenAPI y servicios de acceso a datos.
- **`features/`**: Módulos funcionales organizados por dominio de negocio con aislamiento estricto entre sí.

Para más detalles, consulta [docs/architecture/frontend-architecture.md](docs/architecture/frontend-architecture.md).

---

## 4. Tecnologías

- **Framework**: Angular 22 (Standalone Components, Signals, Router, Control Flow).
- **Lenguaje**: TypeScript 6 (Modo estricto habilitado).
- **Estilos**: SCSS modular estructurado en tokens de diseño, tipografía y mixins responsive.
- **Componentes UI Móviles**: Ionic Angular 9 (Standalone).
- **Runtime Híbrido**: Capacitor 8 (Plataforma Android).
- **PWA**: Angular Service Worker (`@angular/service-worker`) y Web App Manifest.
- **Autenticación**: Auth0 Angular SDK (`@auth0/auth0-angular`).
- **Linter**: ESLint con `@angular-eslint`.
- **Pruebas Unitarias**: Vitest.
- **Contenedores**: Docker (Multi-stage build) y Nginx (Servidor SPA de producción).
- **Integración Continua**: GitHub Actions.

---

## 5. Requisitos

- **Node.js**: `>= 20.x` (Recomendado Node.js 22 LTS).
- **npm**: `>= 10.x`.
- **Docker** (Opcional, para ejecución en contenedores).
- **Android Studio y Android SDK** (Requerido únicamente para compilación del paquete nativo Android).

---

## 6. Instalación

Clona el repositorio e instala las dependencias del proyecto:

```bash
git clone https://github.com/Seb-233/fixup-frontend.git
cd fixup-frontend
npm ci
```

---

## 7. Ejecución Local

Para iniciar el servidor de desarrollo local:

```bash
npm start
# o alternativamente
ng serve
```

Navega a `http://localhost:4200/`. La aplicación se recargará automáticamente al detectar cambios en el código.

---

## 8. Pruebas

Para ejecutar la suite de pruebas unitarias en modo no interactivo (adecuado para entornos de CI):

```bash
npm run test -- --watch=false
```

Para ejecutar el linter y validar reglas de estilo de código:

```bash
npm run lint
```

---

## 9. Build Web

Para compilar la aplicación para producción con optimizaciones de empaquetado:

```bash
npm run build
```

Los artefactos compilados se generarán en el directorio `dist/fixup-frontend/browser`.

---

## 10. PWA (Progressive Web App)

La aplicación incluye soporte para Progressive Web App configurado en `ngsw-config.json` y `src/manifest.webmanifest`. El Service Worker se activa automáticamente en compilaciones de producción (`!isDevMode()`), permitiendo almacenamiento en caché de activos estáticos y funcionamiento sin conexión.

---

## 11. Capacitor Android

La aplicación está preparada para ejecutarse como contenedor híbrido en Android:

```bash
# Compilar la aplicación web y sincronizar activos nativos
npm run build
npx cap sync android

# Abrir el proyecto en Android Studio
npx cap open android
```

---

## 12. Docker y Nginx

Para construir y desplegar la aplicación mediante Docker utilizando la configuración de Nginx optimizada para SPA:

```bash
# Construir la imagen Docker
docker build -t fixup-frontend .

# Ejecutar el contenedor en el puerto 8080
docker run -d -p 8080:80 --name fixup-app fixup-frontend
```

Accede a la aplicación desde `http://localhost:8080/`.

---

## 13. Estructura del Proyecto

```text
fixup-frontend/
├── src/
│   ├── app/
│   │   ├── core/                    # Servicios globales, Auth0, interceptores
│   │   ├── layout/                  # Shells de escritorio y móvil, barras de navegación
│   │   ├── shared/                  # Componentes y utilidades reutilizables
│   │   ├── api/                     # Clientes generados para servicios REST
│   │   └── features/                # Módulos organizados por dominio de negocio
│   ├── assets/                      # Iconos e imágenes estáticas
│   ├── environments/                # Configuración de entornos
│   └── styles/                      # Sistema de diseño, tokens SCSS y tipografía
├── android/                         # Proyecto contenedor nativo de Capacitor
├── e2e/                             # Pruebas End-to-End
├── nginx/                           # Configuración de servidor Nginx para SPA
├── scripts/                         # Scripts de compilación, sincronización y pruebas
├── .github/workflows/               # Pipelines de Integración Continua (CI)
├── Dockerfile                       # Construcción multi-stage de producción
├── capacitor.config.ts              # Configuración de Capacitor
├── angular.json                     # Configuración del espacio de trabajo Angular
└── package.json                     # Manifiesto de dependencias y scripts
```

---

## 14. Documentación Adicional

- [Arquitectura Detallada](docs/architecture/frontend-architecture.md): Principios técnicos y diseño en capas.
- [Guía de Contribución](CONTRIBUTING.md): Estrategia de ramas, convención de commits y flujo de Pull Requests.

---

## 15. Contribución

Todo desarrollo y corrección debe integrarse mediante Pull Requests hacia la rama `develop` siguiendo los lineamientos detallados en [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 16. Equipo

Desarrollado y mantenido por el equipo de arquitectura y desarrollo de **FixUp**.
