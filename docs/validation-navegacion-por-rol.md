# Validación de navegación y errores por rol (E2-S2)

Prueba: `e2e/web/navegacion-por-rol.spec.ts`. Requisitos: RNF-14 (usabilidad) y RNF-17 (comprobabilidad).

## Qué comprueba

Cada comprobación es una aserción de Playwright: si no se cumple, la prueba falla. El JSON y las capturas que se adjuntan son evidencia complementaria, no el veredicto.

| Conjunto | Etiqueta | Qué hace |
|---|---|---|
| Smoke | `@smoke` | Propietario: entrada con la cuenta demo, Inicio con menú, una ruta de otro rol termina en «Acceso denegado» sin pedir datos, y una ruta inexistente vuelve a Inicio |
| Completo | `@completo` | Los cinco roles, cada uno con las cuatro pruebas de abajo |

Las cuatro pruebas del conjunto completo:

1. **Menú, rutas protegidas y redirecciones.**
   - Cada enlace del menú lateral abre su URL exacta, con título, sin alertas de error y sin respuestas 4xx o 5xx de la API. La prueba espera a que terminen las llamadas a la API, y si no terminan, falla.
   - Tres rutas de otros roles terminan en «Acceso denegado» sin ninguna llamada de datos.
   - Una ruta inexistente vuelve a Inicio.
   - El enlace viejo `/visits/:id` lleva a la Agenda, o a «Acceso denegado» en el caso del administrador.
2. **Falla 500 del servidor.** En una pantalla fija por rol:
   - Se muestra un mensaje de error y el botón «Reintentar».
   - En una ventana de 4 s no hay reintentos automáticos.
   - Al quitar la falla, «Reintentar» recupera la pantalla.
   - La simulación de la falla se retira siempre en un `finally`.
3. **Falla 503.** Las mismas comprobaciones que con 500.
4. **Barra inferior móvil a 375 px.**
   - Tiene como máximo cuatro accesos.
   - Ningún rótulo se corta: se compara el ancho natural del texto con el de su caja.

## Defectos conocidos

| Defecto | Issue | Responsable | Cómo lo trata la prueba |
|---|---|---|---|
| E2-S2-D1 · «Solicitudes» (propietario, arrendatario e inmobiliaria) y «Disponibles» (técnico) se cortan a 375 px | #53 | Mateo | Excepción trazable: la prueba de rótulos está marcada `test.fail` solo para esos cuatro roles. Cuando se arregle, la prueba pasará, Playwright avisará y habrá que quitar la excepción |
| E2-S2-D2 · Ante 500 o 503 el mensaje dice «Revisa tu conexión», aunque la falla es del servidor | #54 | Mateo | La prueba exige el mensaje, «Reintentar» y la recuperación, pero no valida el texto. El texto queda registrado como defecto |

Con estos dos defectos abiertos, la corrida **no** demuestra el cumplimiento total de RNF-14. Demuestra la navegación por rol, el bloqueo de rutas ajenas y la recuperación ante fallas del servidor.

## Dónde se puede ejecutar

La suite usa las cuentas de demostración y la semilla sintética del perfil `demo` del backend, así que tiene dos restricciones:
- Solo corre con `E2E_DEMO=1`. Sin esa variable se omite, y `npm run test:e2e` no la ejecuta.
- Solo acepta como `baseURL` `localhost` o `127.0.0.1`, o los hosts que liste `E2E_DEMO_HOSTS`, que solo deben ser ambientes de prueba. Nunca debe apuntar a producción ni a un ambiente con datos reales.

**En local:**
1. Levantar el backend con el perfil `demo` y la semilla (`FIXUP_SEED_ENABLED=true`), con PostgreSQL y almacenamiento S3.
2. Servir la app con `ng serve`; `proxy.conf.js` envía `/api` al backend.
3. Correr el smoke o la suite completa:

```bash
npm run test:e2e:nav:smoke
```

```bash
npm run test:e2e:nav
```

`E2E_BASE_URL` cambia la URL de la app (por defecto `http://localhost:4200`). El resultado y las capturas quedan en `test-results/navegacion-por-rol/`, que git ignora. Si una prueba falla, Playwright guarda la captura y la traza (`trace: 'retain-on-failure'`).

**En CI:** el workflow `.github/workflows/e2e-demo.yml` corre en cada PR que toca `e2e/` o la configuración de Playwright, y también a mano. Arma un ambiente efímero dentro del runner:
- PostgreSQL 17 y S3 (SeaweedFS).
- El backend de `develop` con el perfil `demo`.
- `ng serve`.

Primero corre el smoke y después la suite completa, y sube como artefacto `test-results/`, el reporte HTML y los logs. No usa secretos.

## Corrida de referencia (15/11/2026, local)

**Entorno:** PostgreSQL 17 y S3 en Docker, con el backend y el frontend de la rama `feat/saf-01-conciliacion-pagos`.

**Resultado:** 26 de 26 pruebas con el resultado esperado. Eso incluye cuatro fallos esperados: los rótulos cortados de #53, que se detectaron como «Solicitudes» ×3 y «Disponibles» ×1. El administrador pasa todas sus pruebas.

Del 14/11 se conservan cuatro capturas en `validation-navegacion-por-rol/`, junto con el `resultado.json` del script anterior:
- `barra-movil-por-rol.png`: la barra de los cinco roles.
- `propietario-falla-500.jpg`.
- `tecnico-falla-503.jpg`.
- `arrendatario-acceso-denegado.jpg`.
