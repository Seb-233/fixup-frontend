# FixUp Frontend

Frontend oficial de la plataforma **FixUp**. Desarrollado con una arquitectura responsive unificada en **Angular Standalone**, preparada para operar simultáneamente como:
- **Aplicación Web Responsive** (Desktop y Móvil).
- **PWA (Progressive Web App)** instalable con soporte offline y Service Worker.
- **Aplicación Android Nativa** empaquetada mediante **Capacitor**.

> **Nota de Fase FRONT-000:** Esta versión contiene exclusivamente la estructura base, convenciones, herramientas de compilación, linteo, pruebas, integración de Capacitor Android y contenedor Docker/Nginx. No contiene casos de uso, lógica de negocio ni integración con un tenant real de autenticación.

---

## 🛠️ Stack Tecnológico

- **Framework**: Angular 22 (Standalone Components, Signals, Router, Control Flow syntax).
- **Lenguaje**: TypeScript 6 (Modo estricto activado).
- **Estilos**: SCSS modular con sistema de tokens de diseño y tipografías locales.
- **Componentes Móviles**: Ionic Angular 9 (Standalone).
- **Runtime Nativo**: Capacitor 8 (Plataforma Android).
- **PWA & Offline**: Angular Service Worker (`@angular/service-worker`) con `manifest.webmanifest`.
- **Autenticación**: `@auth0/auth0-angular` (Arquitectura desacoplada, configurada con placeholders).
- **Linter**: ESLint con `@angular-eslint`.
- **Pruebas Unitarias**: Vitest (`ng test --watch=false`).
- **Contenedores**: Docker (Multi-stage build) y Nginx (Servidor SPA con compresión y headers de seguridad).
- **CI/CD**: GitHub Actions (`.github/workflows/frontend-ci.yml`).

---

## 📁 Estructura del Proyecto

```text
fixup-frontend/
├── src/
│   ├── app/
│   │   ├── core/                    # Servicios globales y transversales
│   │   │   ├── auth/                # Arquitectura de autenticación Auth0 (stubs/adapters)
│   │   │   ├── config/              # Configuraciones de la aplicación
│   │   │   ├── guards/              # Route guards globales
│   │   │   ├── interceptors/        # Interceptores HTTP
│   │   │   ├── errors/              # Manejo global de errores
│   │   │   └── services/            # Servicios transversales
│   │   ├── layout/                  # Shell visual y navegación responsiva
│   │   │   ├── desktop-shell/       # Contenedor de vista de escritorio
│   │   │   ├── mobile-shell/        # Contenedor de vista móvil
│   │   │   ├── sidebar/             # Barra de navegación lateral (escritorio)
│   │   │   ├── topbar/              # Barra superior global
│   │   │   └── bottom-navigation/   # Navegación inferior (móvil)
│   │   ├── shared/                  # Componentes y utilidades reutilizables (sin lógica de negocio)
│   │   │   ├── components/          # Componentes tontos (dumb/presentational)
│   │   │   ├── directives/          # Directivas compartidas
│   │   │   ├── models/              # Modelos e interfaces comunes
│   │   │   ├── pipes/               # Pipes personalizados
│   │   │   ├── validators/          # Validadores reactivos
│   │   │   └── utilities/           # Helpers puros desacoplados
│   │   ├── api/
│   │   │   └── generated/           # Clientes generados por OpenAPI (futuras fases)
│   │   └── features/                # Módulos organizados por dominio de negocio
│   │       ├── authentication/
│   │       ├── dashboard/
│   │       ├── properties/
│   │       ├── fixers/
│   │       ├── requests/
│   │       ├── quotations/
│   │       ├── jobs/
│   │       ├── notifications/
│   │       ├── messaging/
│   │       ├── payments/
│   │       ├── contracts/
│   │       ├── analytics/
│   │       └── administration/
│   ├── assets/                      # Recursos estáticos locales
│   │   ├── icons/                   # Iconos SVG y gráficos
│   │   ├── images/                  # Imágenes del sistema
│   │   └── fonts/                   # Fuentes locales (Comfortaa e Inter)
│   ├── environments/                # Configuración por ambientes
│   │   ├── environment.ts           # Configuración de desarrollo local (placeholders)
│   │   └── environment.example.ts   # Plantilla de referencia
│   ├── styles/                      # Sistema de diseño SCSS
│   │   ├── _tokens.scss             # Paleta de color, radios, sombras y breakpoints
│   │   ├── _typography.scss         # Fuentes locales y jerarquía tipográfica
│   │   ├── _layout.scss             # Mixins responsive y contenedores
│   │   └── styles.scss              # Hoja de estilos global consolidada
│   ├── app.config.ts                # Proveedores y bootstrap standalone
│   ├── app.routes.ts                # Rutas y placeholders de navegación
│   └── manifest.webmanifest         # Manifiesto de aplicación PWA
├── android/                         # Proyecto contenedor nativo Android de Capacitor
├── e2e/                             # Pruebas End-to-End
│   ├── web/
│   └── android/
├── nginx/
│   └── nginx.conf                   # Configuración del servidor Nginx SPA
├── scripts/
│   ├── build-web.sh                 # Script de compilación web
│   ├── sync-android.sh              # Script de sincronización con Capacitor Android
│   └── test.sh                      # Script de pruebas y linteo
├── .github/
│   └── workflows/
│       └── frontend-ci.yml          # Pipeline de integración continua
├── Dockerfile                       # Construcción multi-stage Docker
├── capacitor.config.ts              # Configuración de Capacitor Android
├── angular.json                     # Configuración de Angular CLI y Service Worker
└── package.json                     # Dependencias y scripts
```

---

## 🎨 Sistema de Diseño y Tipografía

### Paleta Oficial de Colores
- `#2D2E31`: Primario oscuro (Charcoal).
- `#9A948D`: Acento neutro / Gris cálido.
- `#CEAC78`: Acento dorado / Beige arena.
- `#F8F8F8`: Fondo claro (Off-white).
- `#423D32`: Secundario café profundo.
- `#795548`: Secundario marrón tierra.

### Tipografías Locales
Para garantizar privacidad, soporte PWA offline y evitar dependencias de internet en runtime:
- **Títulos**: `Comfortaa` (Cargada localmente mediante `@fontsource/comfortaa` y `src/assets/fonts/`).
- **Contenido**: `Inter` (Cargada localmente mediante `@fontsource/inter` y `src/assets/fonts/`).

---

## 🚀 Entorno Local y Comandos

### Requisitos Previos
- Node.js versión `>= 20.x` (Recomendado Node 22).
- npm versión `>= 10.x`.
- Android Studio / SDK (requerido únicamente para compilar APK en fases posteriores).

### Instalación de dependencias
```bash
npm ci
```

### Servidor de Desarrollo
```bash
npm start
# o
ng serve
```
Disponible en `http://localhost:4200/`.

### Compilación Web
```bash
npm run build
```
Los archivos optimizados se generan en `dist/fixup-frontend/browser`.

### Ejecución de Pruebas Unitarias
El proyecto utiliza Vitest en modo no interactivo (compatible con CI):
```bash
npm run test -- --watch=false
```

### Verificación de Linteo
```bash
npm run lint
```

### Sincronización con Capacitor Android
```bash
npx cap sync android
```
Copia los artefactos web de `dist/fixup-frontend/browser` a `android/app/src/main/assets/public` y actualiza plugins.

### Ejecución con Docker y Nginx
```bash
# Construir imagen
docker build -t fixup-frontend .

# Ejecutar contenedor
docker run -d -p 8080:80 --name fixup-app fixup-frontend
```
Acceder mediante `http://localhost:8080/`.

---

## 🔒 Políticas de Seguridad y Manejo de Secretos

### Archivos Estrictamente Prohibidos en el Repositorio
Está terminantemente prohibido versionar:
- Archivos de entorno: `.env`, `.env.local`, `.env.*` (única excepción autorizada: `.env.example`).
- Configuraciones locales: `environment.local.ts`, `android/local.properties`, `android/key.properties`.
- Llaves de firma: `*.jks`, `*.keystore`, `*.p12`, `*.pfx`, `upload-keystore.*`, `release-keystore.*`.
- Credenciales de servicios: `google-services.json`, `GoogleService-Info.plist`, `service-account*.json`.
- Artefactos compilados: `dist/`, `www/`, `*.apk`, `*.aab`.

### Reglas de Autenticación con Auth0
- Las aplicaciones cliente (SPA y Android Capacitor) son clientes públicos sin backend seguro; **nunca** deben incluir `Client Secret`, `Management API Token` ni claves privadas.
- `domain`, `clientId` y `audience` se manejan por ambiente mediante variables y en esta fase utilizan placeholders.
- El interceptor HTTP de autenticación está configurado para **adjuntar tokens únicamente a las rutas autorizadas de la API FixUp** (`environment.apiBaseUrl`), evitando filtraciones hacia URLs de terceros.

### Protocolo ante Exposición Accidental de Secretos
En caso de detectar la inclusión accidental de cualquier credencial o secreto:
1. **Detener inmediatamente el trabajo** y notificar al equipo técnico.
2. **No limitarse a borrar el archivo** en un commit posterior; el secreto permanece en el historial de Git.
3. **Revocar y rotar la credencial expuesta de inmediato** en el proveedor correspondiente.
4. Seguir las instrucciones del orquestador para depurar el historial con herramientas especializadas (`git-filter-repo` / BFG).

---

## 🌿 Convenciones de Git y Flujo de Trabajo

- **Rama principal**: `main` (protegida; no se permiten pushes directos).
- **Rama de trabajo**: `chore/frontend-project-structure`.
- **Commits**: Seguir el estándar de Conventional Commits:
  - `chore(frontend): initialize Angular project`
  - `chore(ionic): configure Ionic and Capacitor`
  - `chore(structure): create feature-based folders`
  - `chore(pwa): configure service worker`
  - `ci(frontend): add verification workflow`
  - `docs(frontend): document setup and security rules`
- **Entregas**: Todo cambio se entrega mediante Pull Request hacia `main` y requiere aprobación previa.
