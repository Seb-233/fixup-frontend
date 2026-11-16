import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// RNF-17 · Los cuatro flujos críticos en la interfaz.
//
// El requisito nombra UC-01, UC-13, UC-16 y UC-19, y pide que se puedan verificar con pruebas
// automatizadas repetibles. En el backend los cuatro están cubiertos en distinto grado
// (ver docs/rnf-17-trazabilidad.md en Seb-233/fixup-backend); aquí se cubre lo que solo se puede
// comprobar desde el navegador, que es precisamente lo que la métrica agrega al nombrar Playwright.
//
// El reparto no es casual. Dos de estas comprobaciones llegan donde el backend no llega:
//
//   UC-13  El backend afirma dos de los diez campos del reporte: total y count. El desglose por
//          mes, especialidad e inmueble, la comparación con el periodo anterior y la descarga en
//          CSV no se verifican en ninguna prueba del backend. Aquí sí.
//   UC-19  El recorrido completo existe en el backend, pero dentro de una clase cuyo asunto es
//          otro y que solo corre bajo el perfil postgres-it. Aquí queda nombrado y visible.
//
// Las otras dos comprueban lo que el backend no puede ver: que la pantalla exista, que el rol
// correcto llegue y el equivocado no.
//
// Mismo contrato que navegacion-por-rol.spec.ts: cuentas de demostración y semilla del perfil
// `demo` del backend, así que solo corre con E2E_DEMO=1 y contra un host autorizado. Nunca debe
// apuntar a producción ni a un ambiente con datos reales.
//
//   @flujos  → los cuatro flujos críticos de RNF-17.

const DEMO_ENABLED = process.env.E2E_DEMO === '1';
const ALLOWED_HOSTS = (process.env.E2E_DEMO_HOSTS ?? 'localhost,127.0.0.1')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const OUT = process.env.FLUJOS_OUT ?? path.resolve('test-results/flujos-criticos-rnf17');

const ACCESO_DENEGADO = /\/auth\/access-denied$/;

const CUENTAS = {
  propietaria: 'Carolina Restrepo Arango',
  tecnico: 'Jhon Fredy Cárdenas Ospina',
  administrador: 'Soporte Fix&Rent'
} as const;

test.skip(!DEMO_ENABLED, 'Requiere E2E_DEMO=1 y un backend con perfil demo en un ambiente de pruebas autorizado.');

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(baseURL ?? 'http://localhost').hostname;
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new Error(`Host no autorizado para pruebas con cuentas demo: ${host}. Agrégalo a E2E_DEMO_HOSTS solo si es un ambiente de pruebas.`);
  }
});

async function entrar(page: Page, nombre: string) {
  await page.goto('/login');
  await page.locator('button.demo-row', { hasText: nombre }).click();
  await expect(page, `${nombre}: el ingreso de demostración debe llevar a Inicio`).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

// ─────────────────────────────── precondiciones por la API
//
// UC-19 necesita un trabajo abierto, y la semilla de demostración no deja ninguno. En vez de
// depender de eso, la prueba lo construye recorriendo el mismo camino que la aplicación: la
// propietaria abre una solicitud, el técnico cotiza, ella acepta y el pago se aprueba en la
// pasarela simulada. El trabajo nace de ahí. Se hace por la API y no por la interfaz porque lo que
// se quiere verificar en el navegador es el avance del trabajo, no volver a probar el pago, que ya
// tiene su propia prueba en browser-certification.spec.ts.

const API = process.env.E2E_API_URL ?? 'http://localhost:8080';

async function tokenDemo(rol: string): Promise<string> {
  const res = await fetch(`${API}/demo/token?role=${rol}`);
  if (!res.ok) throw new Error(`/demo/token?role=${rol} respondió ${res.status}. ¿El backend corre con el perfil demo?`);
  return (await res.json()).accessToken;
}

async function llamar(metodo: string, ruta: string, token: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
      ...cabeceras
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${metodo} ${ruta} respondió ${res.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Deja un trabajo abierto y asignado al técnico de la semilla. Devuelve lo que hizo falta crear. */
async function abrirUnTrabajo() {
  const propietaria = await tokenDemo('OWNER');
  const tecnico = await tokenDemo('FIXER');

  const inmuebles = await llamar('GET', '/properties/me', propietaria);
  if (!Array.isArray(inmuebles) || !inmuebles.length) {
    throw new Error('La propietaria de demostración no tiene inmuebles: sin inmueble no hay solicitud que abrir.');
  }
  const propertyId = inmuebles[0].id;

  // El texto no es decorativo: la especialidad de la solicitud la deduce un clasificador por
  // palabras clave, y el técnico solo puede cotizar si la tiene. "fuga", "agua" y "lavamanos"
  // dan PLUMBING, que es una de las tres del técnico sembrado.
  // El título lleva marca de tiempo para poder encontrar DESPUÉS este trabajo exacto entre los del
  // técnico. Tomar el primero de la lista no sirve: si hay otros, la prueba termina verificando
  // uno que no creó.
  const titulo = `Fuga de agua en el lavamanos ${Date.now()}`;
  const solicitud = await llamar('POST', '/requests', propietaria, {
    propertyId,
    title: titulo,
    description: 'El grifo del lavamanos gotea y la tubería de desagüe tiene humedad.',
    mediaIds: [],
    paymentMethod: 'TRANSFER'
  });
  const requestId = solicitud.requestId ?? solicitud.id;

  const cotizacion = await llamar('POST', '/quotations', tecnico, {
    requestId,
    amount: 250000,
    estimatedDays: 3,
    message: 'Cambio de grifo y sifón.'
  });

  // Desde FR-UC-22 aceptar no abre el trabajo: inicia un pago. El trabajo nace cuando un intento
  // por la pasarela simulada queda aprobado.
  const aceptada = await llamar('POST', `/quotations/${cotizacion.id}/accept`, propietaria);
  const pago = await llamar('GET', `/payments/${aceptada.paymentId}`, propietaria);
  await llamar('POST', `/payments/${aceptada.paymentId}/attempts`, propietaria,
    { reference: pago.reference, amount: pago.amount, instrument: 'SANDBOX_CARD' },
    { 'Idempotency-Key': randomUUID() });

  return { titulo, propertyId, requestId, quotationId: cotizacion.id, paymentId: aceptada.paymentId };
}

async function capturar(page: Page, testInfo: TestInfo, nombre: string) {
  const body = await page.screenshot({ type: 'jpeg', quality: 70 });
  await testInfo.attach(nombre, { body, contentType: 'image/jpeg' });
  fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'capturas', `${nombre}.jpg`), body);
}

async function guardarEvidencia(testInfo: TestInfo, nombre: string, datos: unknown) {
  const body = JSON.stringify(datos, null, 2);
  await testInfo.attach(`${nombre}.json`, { body, contentType: 'application/json' });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${nombre}.json`), body);
}

// ───────────────────────────────────────────────────────── UC-01

test.describe('UC-01 · Proyecto de remodelación multi-profesional', { tag: '@flujos' }, () => {
  test('la propietaria crea una remodelación con su requerimiento y la ve en la lista', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.propietaria);

    // Si el backend rechaza la creación, la pantalla solo dice "No pudimos crear la remodelación".
    // Se guarda la respuesta real para que el fallo nombre la causa en vez de limitarse a avisar
    // que la URL no cambió. Ojo con una en particular: crear una remodelación abre una solicitud
    // por requerimiento, y esa ruta comprueba la deuda del propietario con una función que solo
    // existe en las migraciones de PostgreSQL, así que contra H2 responde 500.
    const rechazos: string[] = [];
    page.on('response', async (r) => {
      if (r.request().method() !== 'POST' || r.status() < 400) return;
      if (new URL(r.url()).pathname !== '/remodelings') return;
      const cuerpo = await r.text().catch(() => '');
      rechazos.push(`${r.status()} ${cuerpo}`.slice(0, 300));
    });

    await page.goto('/remodelings');
    await expect(page.locator('.page-header h1')).toHaveText('Remodelaciones');

    await page.locator('a[routerLink="/remodelings/new"]').first().click();
    await expect(page).toHaveURL(/\/remodelings\/new$/);

    // El inmueble se toma del desplegable en vez de inventar un identificador: así la prueba
    // depende de lo que la semilla realmente sembró y no de un dato quemado que se desactualiza.
    const selector = page.locator('#property');
    await expect(selector).toBeVisible();

    // Se comprueba que las opciones EXISTAN, no que se vean: una <option> dentro de un <select>
    // colapsado nunca es visible para Playwright, así que toBeVisible() aquí siempre fallaría.
    const inmuebles = selector.locator('option:not([disabled])');
    await expect(inmuebles, 'la semilla demo debe dejarle al menos un inmueble a la propietaria').not.toHaveCount(0);
    const inmueble = await inmuebles.first().getAttribute('value');
    expect(inmueble, 'el desplegable de inmuebles no trajo ningún valor').toBeTruthy();
    await selector.selectOption(inmueble!);

    const titulo = `Remodelación de prueba ${Date.now()}`;
    await page.locator('#title').fill(titulo);
    await page.locator('#description').fill('Proyecto creado por la prueba automatizada de RNF-17.');
    // El detalle del requerimiento es obligatorio, no decorativo: sin él el formulario responde
    // "Cada requerimiento necesita qué hacer y un detalle" y no envía nada.
    await page.locator('#req-title-0').fill('Pintar paredes y techo de la sala');
    await page.locator('#req-desc-0').fill('Dos manos de vinilo sobre pared preparada, incluye estuco de las fisuras.');
    await page.locator('#req-urg-0').selectOption('MEDIUM');

    await capturar(page, testInfo, 'uc01-formulario-diligenciado');
    await page.getByRole('button', { name: 'Crear remodelación' }).click();

    // El formulario puede quedarse en el detalle o volver a la lista; lo que importa es que el
    // proyecto exista y se pueda encontrar por su título.
    try {
      await expect(page).not.toHaveURL(/\/remodelings\/new$/, { timeout: 20_000 });
    } catch {
      const aviso = (await page.locator('[role="alert"]').first().textContent().catch(() => ''))?.trim();
      throw new Error('La creación no salió de /remodelings/new.'
        + `\n  Aviso en pantalla: ${aviso || '(ninguno)'}`
        + `\n  Respuesta del backend: ${rechazos.join(' | ') || '(ninguna petición falló; revisa la validación del formulario)'}`);
    }

    await page.goto('/remodelings');
    const fila = page.locator('ul.projects .row-title', { hasText: titulo });
    await expect(fila, 'la remodelación recién creada debe aparecer en la lista').toBeVisible({ timeout: 15_000 });

    await capturar(page, testInfo, 'uc01-lista-con-el-proyecto');
    await guardarEvidencia(testInfo, 'uc01-remodelacion', { titulo, inmueble });
  });
});

// ───────────────────────────────────────────────────────── UC-13

test.describe('UC-13 · Reporte de gastos de mantenimiento', { tag: '@flujos' }, () => {
  test('el reporte muestra los tres desgloses y la comparación con el periodo anterior', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.propietaria);

    await page.goto('/expenses');
    await expect(page.locator('.page-header h1')).toContainText('Reporte de gastos');

    // Esto es lo que el backend no verifica. ExpenseReport tiene diez campos y sus pruebas afirman
    // dos (total y count); los tres desgloses y la comparación con el periodo anterior solo se
    // comprueban aquí.
    await expect(page.getByText('Total del periodo', { exact: false })).toBeVisible();
    await expect(page.getByText('Frente al periodo anterior', { exact: false })).toBeVisible();
    await expect(page.locator('#month-title'), 'falta el desglose por mes').toBeVisible();
    await expect(page.locator('#spec-title'), 'falta el desglose por especialidad').toBeVisible();
    await expect(page.locator('#prop-title'), 'falta el desglose por inmueble').toBeVisible();

    await capturar(page, testInfo, 'uc13-reporte-completo');

    const desgloses = {
      porMes: (await page.locator('#month-title').textContent())?.trim(),
      porEspecialidad: (await page.locator('#spec-title').textContent())?.trim(),
      porInmueble: (await page.locator('#prop-title').textContent())?.trim()
    };
    await guardarEvidencia(testInfo, 'uc13-desgloses', desgloses);
  });

  test('el filtro de periodo se aplica sin romper el reporte', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.propietaria);
    await page.goto('/expenses');

    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    await page.locator('#from').fill(iso(desde));
    await page.locator('#to').fill(iso(hoy));
    await page.getByRole('button', { name: 'Ver reporte' }).click();

    await expect(page.locator('#month-title')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.alert-danger:visible, .error:visible'), 'el filtro no debe dejar la pantalla en error').toHaveCount(0);

    await capturar(page, testInfo, 'uc13-reporte-filtrado');
  });

  test('la descarga en CSV entrega un archivo', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.propietaria);
    await page.goto('/expenses');

    // toCsv no se ejercita en ninguna prueba del backend: /analytics/expenses/csv solo aparece en
    // OpenApiContractTest, que comprueba que la ruta esté documentada, no que devuelva algo.
    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /Descargar CSV/i }).click()
    ]);

    const nombre = descarga.suggestedFilename();
    const ruta = await descarga.path();
    expect(ruta, 'la descarga no produjo ningún archivo').toBeTruthy();
    const bytes = fs.statSync(ruta!).size;
    expect(bytes, 'el CSV descargado llegó vacío').toBeGreaterThan(0);

    await guardarEvidencia(testInfo, 'uc13-csv', { nombre, bytes });
  });
});

// ───────────────────────────────────────────────────────── UC-16

test.describe('UC-16 · Registro y validación del técnico', { tag: '@flujos' }, () => {
  test('el técnico ve su estado, sus especialidades y sus documentos', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.tecnico);

    await page.goto('/fixers/verification');
    await expect(page.locator('.page-header h1')).toContainText('Verificación');
    await expect(page.locator('#spec-title'), 'falta la sección de especialidades').toBeVisible();
    await expect(page.locator('#docs-title'), 'falta la sección de documentos').toBeVisible();

    await capturar(page, testInfo, 'uc16-verificacion-del-tecnico');
  });

  // Las dos caras del control de acceso van en pruebas separadas a propósito. Cambiar de cuenta
  // dentro de una misma prueba no funciona: con sesión activa, /login no vuelve a mostrar los
  // botones de las cuentas de demostración. Cada test de Playwright trae su contexto limpio, que
  // es la forma correcta de entrar con otro usuario.
  test('el administrador abre la cola de revisión', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.administrador);
    await page.goto('/administration/fixer-review');
    await expect(page.locator('.page-header h1')).toContainText('Verificación de técnicos');
    await capturar(page, testInfo, 'uc16-cola-de-revision');
  });

  // La decisión de aprobar o rechazar la gobierna el backend, y allí está cubierta por las 33
  // pruebas de FixerVerificationHttpContract en los dos motores. Lo que solo se puede comprobar
  // desde el navegador es que la pantalla exista para quien corresponde y no para los demás.
  test('la propietaria no puede abrir la cola de revisión', async ({ page }, testInfo) => {
    await entrar(page, CUENTAS.propietaria);
    await page.goto('/administration/fixer-review');
    await expect(page, 'la propietaria no debe poder abrir la cola de revisión').toHaveURL(ACCESO_DENEGADO, { timeout: 15_000 });
    await capturar(page, testInfo, 'uc16-acceso-denegado-a-la-propietaria');
  });
});

// ───────────────────────────────────────────────────────── UC-19

test.describe('UC-19 · Avance del trabajo', { tag: '@flujos' }, () => {
  test('el técnico abre un trabajo y ve sus acciones de avance y su bitácora', async ({ page }, testInfo) => {
    const creado = await abrirUnTrabajo();
    await guardarEvidencia(testInfo, 'uc19-precondicion', creado);

    await entrar(page, CUENTAS.tecnico);

    await page.goto('/jobs/me');
    await expect(page.locator('.page-header h1')).toContainText('Mis trabajos');

    // Se busca el trabajo POR SU TÍTULO, no el primero de la lista: el técnico puede tener otros y
    // la prueba debe verificar el que ella misma creó.
    const trabajos = page.locator('ul.jobs a.row-link');
    const mio = trabajos.filter({ hasText: creado.titulo });
    await expect(mio, 'el trabajo creado por la precondición no apareció en la bandeja del técnico')
      .toHaveCount(1, { timeout: 15_000 });

    await guardarEvidencia(testInfo, 'uc19-trabajos-del-tecnico', {
      cuantos: await trabajos.count(),
      titulo: creado.titulo
    });
    await mio.click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.locator('main h1, .page-header h1').first(), 'el detalle no abrió el trabajo creado')
      .toContainText(creado.titulo);

    // Los rótulos van completos y literales. Una expresión laxa como /Agendar|Iniciar|Cerrar/ hace
    // que la prueba pase encontrando el botón de "Cerrar sesión" de la barra lateral: verde sin
    // haber verificado nada, que es peor que roja.
    const acciones = page.getByRole('button', {
      name: /Agendar fecha|Mover la fecha|Iniciar trabajo|Agregar fotos|Terminar trabajo/
    });
    await expect(acciones.first(), 'el detalle del trabajo no ofreció ninguna acción de avance').toBeVisible({ timeout: 15_000 });

    // Un trabajo recién abierto tiene que ofrecer agendar e iniciar: son las dos acciones con las
    // que empieza el avance.
    await expect(page.getByRole('button', { name: /Agendar fecha|Mover la fecha/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar trabajo' })).toBeVisible();

    await capturar(page, testInfo, 'uc19-detalle-del-trabajo');

    const bitacora = page.locator('details', { hasText: 'Bitácora del trabajo' });
    if (await bitacora.count()) {
      await bitacora.first().click();
      await expect(page.locator('ol.timeline.log li').first(), 'la bitácora se abrió vacía').toBeVisible();
      await capturar(page, testInfo, 'uc19-bitacora');
    }

    await guardarEvidencia(testInfo, 'uc19-trabajo-abierto', {
      titulo: creado.titulo,
      url: page.url(),
      accionesVisibles: (await acciones.allTextContents()).map((t) => t.trim())
    });
  });
});
