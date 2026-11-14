# Navegación y errores por rol (14/11/2026)

Tarea: «Validar navegación y errores por roles» (subtarea de E2-S2). También sirve como evidencia de USA-01, porque muestra que la arquitectura de información se cumple en la app.

**Entorno:** local, con Docker. La base es PostgreSQL 17 (`postgres:17-alpine`, la misma versión de producción). El almacenamiento es S3 con SeaweedFS, porque la imagen de MinIO del proyecto en `ghcr.io` pide credenciales. El backend es de la rama `feat/saf-01-conciliacion-pagos` (develop `d07a2fd` más la conciliación de pagos), con el perfil `demo` y la semilla colombiana: 1200 fotos cargadas en el almacenamiento. El frontend es de la misma rama (`5368e56`) y corre con `ng serve` en el puerto 4400. Las fotos cargan y no hubo ningún error en la consola del navegador.

**Cómo se hizo:** con Playwright en Chrome (`e2e/web/navegacion-por-rol.spec.ts`), entrando con las cinco cuentas de demostración. Aquí van el resultado completo (`validation-navegacion-por-rol/resultado.json`) y cuatro capturas representativas. Las 67 capturas completas están en el repositorio de pruebas (`FixUp---pruebas-A.S`, `docs/entrega-2/navegacion-por-rol/`).

## Resultado

| Comprobación | Propietario | Arrendatario | Técnico | Inmobiliaria | Administrador |
|---|---|---|---|---|---|
| Menú completo en escritorio: cada enlace abre su pantalla, con título, sin alertas de error y sin respuestas 4xx o 5xx de la API | 11/11 | 7/7 | 8/8 | 12/12 | 9/9 |
| Tres rutas de otros roles llevan a «Acceso denegado» sin pedir datos | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| Ruta inexistente → Inicio | ✓ | ✓ | ✓ | ✓ | ✓ |
| Enlace viejo de notificación (`/visits/:id`) → pantalla actual | ✓ Agenda | ✓ Agenda | ✓ Agenda | ✓ Agenda | ✓ Acceso denegado (el administrador no tiene agenda) |
| API con **500**: mensaje de error y «Reintentar», sin ciclo de reintentos; cuando la API vuelve, «Reintentar» recupera la pantalla | ✓ | ✓ | ✓ | ✓ | ✓ |
| API con **503**: igual que con 500 (sigue funcionando el arreglo del ciclo del 503 en Mercado) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Barra inferior móvil (375 px): máximo cuatro accesos más «Más» | 4 | 4 | 4 | 4 | 4 |
| Rótulos completos en la barra móvil | ✗ «Solicitud…» | ✗ «Solicitud…» | ✗ «Disponib…» | ✗ «Solicitud…» | ✓ |
| Errores en la consola del navegador | 0 | 0 | 0 | 0 | 0 |

En total se revisaron 47 pantallas del menú. La más lenta tardó 590 ms entre el clic y quedar quieta (Mercado, en local).

**Sobre el propietario:** en la primera corrida, el clic en «Catálogo» no alcanzó a navegar antes de la medición y la pantalla siguió en Gastos. No se repitió ni en una segunda corrida del mismo rol (11/11, Catálogo en 331 ms) ni al probarlo a mano, donde carga con fotos en unos 260 ms. La tabla usa la segunda corrida y `resultado.json` lo anota en `nota`. Lo más probable es que fuera la primera carga de esa pantalla en `ng serve`, no un error de la app.

## Hallazgos

1. **Rótulos truncados en la barra móvil** (`validation-navegacion-por-rol/barra-movil-por-rol.png`): «Solicitudes» en propietario, arrendatario e inmobiliaria, y «Disponibles» en el técnico. Se arregla con un `shortLabel` en `role-navigation.ts`, como ya se hizo con «Verificaciones» → «Revisión». Falta que Mateo elija las palabras.
2. **El mensaje de error culpa a la conexión.** Ante un 500 o un 503, casi todas las pantallas dicen «Revisa tu conexión e inténtalo de nuevo», aunque la falla es del servidor. Solo «Disponibles» del técnico muestra el mensaje que manda la API. Para usabilidad convendría un texto neutro, por ejemplo: «No pudimos cargar esta información. Inténtalo de nuevo en un momento.»
3. No hubo pantallas rotas, redirecciones equivocadas, ciclos de reintentos ni errores de consola.

La medida automática del truncado no detecta la elipsis en todos los rótulos (en esta corrida solo marcó «Disponibles»), así que el truncado se confirmó mirando las capturas.

## Capturas

- `validation-navegacion-por-rol/barra-movil-por-rol.png`: barra inferior de los cinco roles a 375 px.
- `validation-navegacion-por-rol/propietario-falla-500.jpg`: Inmuebles con la API respondiendo 500.
- `validation-navegacion-por-rol/tecnico-falla-503.jpg`: Disponibles del técnico con 503 (es la única pantalla que muestra el mensaje de la API).
- `validation-navegacion-por-rol/arrendatario-acceso-denegado.jpg`: ruta de otro rol que termina en «Acceso denegado».

## Repetirlo

Se necesita el backend con el perfil `demo` y la semilla (`FIXUP_SEED_ENABLED=true`), con una base PostgreSQL y un almacenamiento S3, y el frontend servido con `ng serve`, que usa `proxy.conf.js` para que `/api` vaya al backend. Luego:

```bash
npx playwright test e2e/web/navegacion-por-rol.spec.ts
```

El script toma la URL de `playwright.config.ts` (`http://localhost:4200`) y deja el resultado y las capturas en `test-results/navegacion-por-rol/`, que git ignora. `NAV_OUT` cambia esa carpeta.
