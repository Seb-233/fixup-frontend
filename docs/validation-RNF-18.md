# Validación RNF-18 — Modificabilidad (fronteras arquitectónicas verificadas)

Fecha local: 2026-11-17 (America/Bogota).
Repositorios: `Seb-233/fixup-frontend` y `Seb-233/fixup-backend`.
Rama: `feat/status-audit-esc-t01` (ambos repos).
Entorno: Node v26.13.0 / Windows; OpenJDK 21.0.13.

## Objetivo del requisito

RNF-18 exige que los módulos de Spring Modulith y del frontend mantengan
dependencias controladas e interfaces explícitas, de modo que el impacto de un
cambio quede acotado. La evidencia no puede ser la mera existencia de carpetas:
debe demostrar **límites arquitectónicos verificados** de forma automática,
componentes afectados por un cambio acotado y ausencia de rotura de contratos
ajenos.

Al inicio del trabajo, el frontend documentaba sus capas únicamente en
`docs/architecture/frontend-architecture.md`, sin ninguna comprobación
automatizada: la regla vivía solo en el documento y ya existían 5 inversiones de
capa reales. El backend ya disponía de Modulith + ArchUnit, pero con un hueco de
cobertura de 3 módulos.

## Alcance verificado

### Backend — Spring Modulith y ArchUnit

- `ModularityTest` ejecuta `ApplicationModules.of(FixupApplication.class).verify()`
  y exige exactamente los **18** módulos del monolito modular: `shared`,
  `identityaccess`, `users`, `fixers`, `properties`, `media`, `requests`,
  `quotations`, `jobs`, `notifications`, `messaging`, `payments`, `contracts`,
  `analytics`, `remodelings`, `visits`, `ratings`, `audit`.
- `LayerRulesTest` (ArchUnit) aplica tres reglas de frontera:
  `sharedMustNotDependOnBusinessModules`, `webMustNotAccessPersistence` y
  `apiMustNotExposePersistence`.
- Se corrigió el hueco de cobertura: `sharedMustNotDependOnBusinessModules` no
  vigilaba `analytics`, `remodelings`, `visits`, `ratings` ni `audit`, por lo que
  un acoplamiento de `shared` hacia esos módulos pasaba inadvertido. Ahora cubre
  los 18 módulos, en coherencia con `ModularityTest` y con `docs/module-rules.md`.

### Frontend — verificación de fronteras de capas

`scripts/check-architecture.mjs` convierte la regla documentada en una
comprobación automática que se ejecuta en la CI (`npm run arch:check`, entre
`lint` y los tests). Recorre los imports reales de `src/app`, resuelve cada
especificador relativo contra su archivo destino y falla ante un cruce
prohibido. Modelo de *tiers* (una capa solo puede depender de las de su tier o
inferior):

| Tier | Capa | Contenido |
| --- | --- | --- |
| 4 | `features/` | Dominios de negocio (una feature NO puede importar otra hermana) |
| 3 | `layout/` | Shells visuales |
| 2 | `api/` `core/` `data/` | Cliente API, singletons transversales y acceso a datos |
| 1 | `shared/` | Reutilizable puro, sin negocio |

Además del criterio de tier, una feature solo puede importar sus propios
archivos. Los archivos de composición directamente bajo `src/app/`
(`app.routes.ts`, `app.config.ts`, `app.component.ts`) están exentos, y
`api/generated/` no se revisa por ser código generado ajeno.

## Componentes afectados por un cambio acotado

El cambio acotado es el traslado de `FixerVerificationStore` de la feature
`features/fixers` a la capa transversal `core/`, para eliminar las dos
inversiones de capa que rompían la frontera (una capa inferior importando una
feature):

- `src/app/core/auth/verified-fixer.guard.ts` — import actualizado a
  `../verification/fixer-verification.store`.
- `src/app/layout/shell/shell.component.ts` — import actualizado a
  `../../core/verification/fixer-verification.store`.
- `src/app/features/fixers/verification.page.ts` — import actualizado a
  `../../core/verification/fixer-verification.store`.

El store (`providedIn: 'root'`) mantiene su interfaz pública intacta: el traslado
no cambió firmas ni comportamiento, solo su ubicación. Su suite
(`fixer-verification.store.spec.ts`) se movió junto a él y se actualizaron las
rutas de import.

## Verificación automatizada

| Suite | Comando | Resultado comprobado |
| --- | --- | --- |
| Fronteras frontend | `npm run arch:check` | **Exit 0**: «Fronteras arquitectónicas del frontend verificadas: sin cruces de capa indebidos». Las 4 excepciones congeladas se consumen (ninguna obsoleta) |
| Lint frontend | `npm run lint` | **Exit 0**: «All files pass linting» |
| Pruebas unitarias frontend | `npm run test` | Suite del store movido en verde (15 pruebas). 187/200 pruebas pasan; 13 fallos ajenos al cambio (ver nota) |
| Arquitectura backend | `.\mvnw.cmd "-Dtest=ModularityTest,LayerRulesTest" test` | **Exit 0**: `ModularityTest` + `LayerRulesTest` en verde |

Nota sobre los 13 fallos de test ajenos al cambio: corresponden a
`src/app/data/known-payments.spec.ts` y
`src/app/features/work/payment-panel.component.spec.ts`, que invocan
`localStorage.clear()`/`sessionStorage.clear()` en `beforeEach`. El entorno local
(Node v26.13.0 / vitest 4.1.11, sin `--localstorage-file`) no expone Web Storage,
por lo que fallan por infraestructura del entorno, no por el cambio de RNF-18.

## Prueba negativa (la verificación falla cuando debe)

Para demostrar que la comprobación no es decorativa, se inyectaron dos archivos
temporales que violaban las reglas y `npm run arch:check` respondió **exit 1**
con el diagnóstico correcto:

```
Cruces de capa prohibidos (RNF-18):

  src/app/features/requests/__arch-probe.ts
    -> src/app/features/dashboard/dashboard.page
    la feature "requests" importa la feature hermana "dashboard"

  src/app/shared/ui/__arch-probe.ts
    -> src/app/features/dashboard/dashboard.page
    la capa "shared" (tier 1) importa la capa "features" (tier 4)
```

Al eliminar las sondas, la comprobación vuelve a **exit 0**. El script también
detecta **excepciones obsoletas**: si un cruce autorizado deja de existir, falla
para obligar a borrar la excepción, de modo que la lista de deuda solo puede
encogerse.

## Deuda arquitectónica congelada

Las siguientes inversiones ya existían y no se corrigen en este alcance: quedan
como excepciones **explícitas y justificadas** en `KNOWN_EXCEPTIONS`, de forma
que se impide cualquier cruce NUEVO.

| Origen | Destino | Motivo |
| --- | --- | --- |
| `shared/ui/states.component.ts` | `core/connectivity/` | El componente de estados de carga/error consume el `ConnectivityService` transversal |
| `shared/ui/photo-picker.component.ts` | `data/media.service` | El selector de fotos reutiliza constantes y el validador de imágenes |
| `features/requests/request-detail.page.ts` | `features/work/` | La vista de solicitud embebe los paneles operativos del dominio de trabajo |
| `features/dashboard/dashboard.page.ts` | `features/ideas/` | El panel reutiliza el feed de ideas como bloque de contenido |

## Contratos ajenos (no rotura)

- El traslado del store no altera su interfaz pública ni el comportamiento
  observable; los tres consumidores solo cambiaron la ruta del import.
- `docs/architecture/frontend-architecture.md` documenta los *tiers*, la capa
  `data/` y la lista de deuda congelada, en coherencia con el script.
- `docs/module-rules.md` refleja los 18 módulos exigidos por `ModularityTest`.

## Commits y entrega

- **frontend** `1000033` — `chore(arquitectura): verificar fronteras de capas del frontend (RNF-18)`.
- **backend** `9c12727` — `test(arquitectura): cubrir los 18 modulos en las reglas de capa (RNF-18)`.
- Ambos en la rama `feat/status-audit-esc-t01`, subidos a su PR correspondiente; `main` sin tocar.
