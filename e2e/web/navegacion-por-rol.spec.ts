import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// E2-S2 · Navegación y errores por rol (RNF-14 usabilidad, RNF-17 comprobabilidad).
//
// Usa las cuentas de demostración y la semilla del perfil `demo` del backend, así que solo
// corre cuando se pide explícitamente (E2E_DEMO=1) y contra un host autorizado: localhost por
// defecto, o los que liste E2E_DEMO_HOSTS. Nunca debe apuntar a producción ni a un ambiente
// con datos reales.
//
//   @smoke     → un rol, rápido: entrada, Inicio, una ruta ajena y una inexistente.
//   @completo  → los cinco roles: menú entero, rutas ajenas, redirecciones, 500/503 con
//                recuperación y barra móvil.
//
// Cada comprobación es una aserción de Playwright: si algo no cumple, la prueba falla.
// El JSON que se adjunta es evidencia complementaria, no el veredicto.

const DEMO_ENABLED = process.env.E2E_DEMO === '1';
const ALLOWED_HOSTS = (process.env.E2E_DEMO_HOSTS ?? 'localhost,127.0.0.1')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const OUT = process.env.NAV_OUT ?? path.resolve('test-results/navegacion-por-rol');

// Rutas de la API que sirve el mismo origen de la app (proxy de ng serve o de nginx).
const API = /^\/(auth|payments|requests|quotations|jobs|media|fixers|properties|locations|contracts|notifications|remodelings|administration|management|visits|ratings|analytics)(\/|$|\?)/;
// Llamadas que el marco hace en cualquier pantalla y que no son datos de la pantalla.
const SHELL_CALLS = /^\/(auth|notifications)(\/|$|\?)/;
const ACCESS_DENIED = '/auth/access-denied';
const ALERT = '.alert-danger:visible, .error:visible';
const RETRY = /reintentar|volver a intentar/i;

type Role = 'OWNER' | 'TENANT' | 'FIXER' | 'REAL_ESTATE_MANAGER' | 'PLATFORM_ADMIN';
interface Account {
  role: Role;
  name: string;
  slug: string;
  /** Rutas de otros roles: deben terminar en «Acceso denegado» sin pedir datos. */
  foreign: string[];
  /** Pantalla en la que se simulan las fallas del servidor. */
  failureTarget: string;
  /** Destino esperado del enlace viejo /visits/:id. */
  legacyVisits: string;
}

const ACCOUNTS: Account[] = [
  { role: 'OWNER', name: 'Carolina Restrepo Arango', slug: 'propietario', foreign: ['/administration/sla-board', '/requests/inbox', '/jobs/me'], failureTarget: '/properties', legacyVisits: '/visits' },
  { role: 'TENANT', name: 'Andrés Moreno Rincón', slug: 'arrendatario', foreign: ['/properties', '/payments', '/management'], failureTarget: '/contracts', legacyVisits: '/visits' },
  { role: 'FIXER', name: 'Jhon Fredy Cárdenas Ospina', slug: 'tecnico', foreign: ['/properties', '/administration/fixer-review', '/expenses'], failureTarget: '/requests/inbox', legacyVisits: '/visits' },
  { role: 'REAL_ESTATE_MANAGER', name: 'Inmobiliaria Cordillera', slug: 'inmobiliaria', foreign: ['/administration/sla-board', '/jobs/me', '/fixers/portfolio'], failureTarget: '/management', legacyVisits: '/visits' },
  { role: 'PLATFORM_ADMIN', name: 'Soporte Fix&Rent', slug: 'administrador', foreign: ['/requests/new', '/payments/earnings', '/properties/new'], failureTarget: '/administration/sla-board', legacyVisits: ACCESS_DENIED }
];

test.skip(!DEMO_ENABLED, 'Requiere E2E_DEMO=1 y un backend con perfil demo en un ambiente de pruebas autorizado.');

test.beforeEach(async ({ baseURL }) => {
  const host = new URL(baseURL ?? 'http://localhost').hostname;
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new Error(`Host no autorizado para pruebas con cuentas demo: ${host}. Agrégalo a E2E_DEMO_HOSTS solo si es un ambiente de pruebas.`);
  }
});

/** Observa la API del mismo origen: errores, llamadas de datos y peticiones en curso. */
function watchApi(page: Page, appOrigin: string) {
  const errors: string[] = [];
  const dataCalls: string[] = [];
  let pending = 0;
  const isApi = (url: string) => {
    const u = new URL(url);
    return u.origin === appOrigin && API.test(u.pathname) ? u : null;
  };
  page.on('request', (r) => {
    const u = isApi(r.url());
    if (!u || !['xhr', 'fetch'].includes(r.resourceType())) return;
    pending++;
    if (!SHELL_CALLS.test(u.pathname)) dataCalls.push(`${r.method()} ${u.pathname}`);
  });
  const done = (r: { url(): string; resourceType(): string }) => {
    if (isApi(r.url()) && ['xhr', 'fetch'].includes(r.resourceType())) pending = Math.max(0, pending - 1);
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.on('response', (r) => {
    const u = isApi(r.url());
    if (u && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${u.pathname}`);
  });
  return {
    reset() { errors.length = 0; dataCalls.length = 0; },
    errors: () => [...errors],
    dataCalls: () => [...dataCalls],
    /** Espera explícita a que no queden llamadas a la API en curso; falla si no termina. */
    async idle(message: string) {
      await expect.poll(() => pending, { message: `${message}: quedaron llamadas a la API sin terminar`, timeout: 15_000 }).toBe(0);
    }
  };
}

async function login(page: Page, account: Account) {
  await page.goto('/login');
  await page.locator('button.demo-row', { hasText: account.name }).click();
  await expect(page, `${account.slug}: el ingreso de demostración debe llevar a Inicio`).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.locator('main h1, .page-header h1').first()).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({ type: 'jpeg', quality: 70 });
  await testInfo.attach(name, { body, contentType: 'image/jpeg' });
  fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'capturas', `${name}.jpg`), body);
}

async function saveEvidence(testInfo: TestInfo, name: string, data: unknown) {
  const body = JSON.stringify(data, null, 2);
  await testInfo.attach(`${name}.json`, { body, contentType: 'application/json' });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), body);
}

const exact = (href: string) => new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

test('smoke · propietario entra, ve Inicio y es bloqueado fuera de su rol', { tag: '@smoke' }, async ({ page, baseURL }) => {
  const owner = ACCOUNTS[0];
  const api = watchApi(page, new URL(baseURL!).origin);
  await login(page, owner);
  await expect(page.locator('aside.sidebar nav a').first(), 'el menú lateral debe tener enlaces').toBeVisible();

  api.reset();
  await page.goto(owner.foreign[0]);
  await expect(page, 'una ruta de otro rol debe terminar en «Acceso denegado»').toHaveURL(exact(ACCESS_DENIED));
  expect(api.dataCalls(), 'una ruta ajena no debe pedir datos a la API').toEqual([]);

  await page.goto('/esta-ruta-no-existe');
  await expect(page, 'una ruta inexistente debe llevar a Inicio').toHaveURL(/\/dashboard$/);
});

for (const account of ACCOUNTS) {
  test.describe(`${account.slug}`, { tag: '@completo' }, () => {
    test('menú, rutas protegidas y redirecciones', async ({ page, baseURL }, testInfo) => {
      test.setTimeout(240_000);
      const api = watchApi(page, new URL(baseURL!).origin);
      await page.setViewportSize({ width: 1280, height: 800 });
      await login(page, account);
      await api.idle('Inicio');

      const links = await page.locator('aside.sidebar nav a').evaluateAll((as) =>
        as.map((a) => ({ href: a.getAttribute('href') ?? '', label: (a.textContent ?? '').replace(/\s+/g, ' ').trim() })));
      expect(links.length, 'el menú lateral no puede estar vacío').toBeGreaterThan(0);
      expect(links.map((l) => l.href), 'el menú debe empezar en Inicio').toContain('/dashboard');

      const evidence: Record<string, unknown>[] = [];
      for (const link of links) {
        await test.step(`menú → ${link.label} (${link.href})`, async () => {
          api.reset();
          const t0 = Date.now();
          await page.locator(`aside.sidebar nav a[href="${link.href}"]`).first().click();
          await expect(page, `${link.label}: la URL debe ser ${link.href}`).toHaveURL(exact(link.href));
          const h1 = page.locator('main h1, .page-header h1').first();
          await expect(h1, `${link.label}: la pantalla debe tener título`).toBeVisible();
          await api.idle(link.label);
          const ms = Date.now() - t0;
          await expect.soft(page.locator(ALERT), `${link.label}: no debe mostrar alertas de error`).toHaveCount(0);
          expect.soft(api.errors(), `${link.label}: la API no debe responder 4xx ni 5xx`).toEqual([]);
          evidence.push({ ...link, titulo: (await h1.textContent())?.trim(), ms });
          await capture(page, testInfo, `${account.slug}-${link.href.replace(/^\//, '').replace(/\//g, '_') || 'inicio'}`);
        });
      }

      for (const href of account.foreign) {
        await test.step(`ruta de otro rol ${href}`, async () => {
          api.reset();
          await page.goto(href);
          await expect(page, `${href}: debe terminar en «Acceso denegado»`).toHaveURL(exact(ACCESS_DENIED));
          await expect(page.locator('main h1, h1').first(), `${href}: la pantalla de acceso denegado debe tener título`).toBeVisible();
          await api.idle(href);
          expect.soft(api.dataCalls(), `${href}: no debe pedir datos a la API`).toEqual([]);
        });
      }
      await capture(page, testInfo, `${account.slug}-acceso-denegado`);

      await test.step('ruta inexistente', async () => {
        await page.goto('/esta-ruta-no-existe');
        await expect(page, 'una ruta inexistente debe llevar a Inicio').toHaveURL(/\/dashboard$/);
      });
      await test.step('enlace viejo de notificación /visits/:id', async () => {
        await page.goto('/visits/00000000-0000-0000-0000-000000000000');
        await expect(page, `/visits/:id debe llevar a ${account.legacyVisits}`).toHaveURL(exact(account.legacyVisits));
      });
      await saveEvidence(testInfo, `${account.slug}-menu`, evidence);
    });

    for (const status of [500, 503]) {
      test(`falla ${status} del servidor: mensaje, Reintentar y recuperación`, async ({ page }, testInfo) => {
        await login(page, account);
        let calls = 0;
        await page.route(
          (u) => API.test(u.pathname) && !SHELL_CALLS.test(u.pathname),
          (route) => {
            if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
            calls++;
            return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status, code: 'SIMULATED_FAILURE', message: 'Falla simulada' }) });
          }
        );
        try {
          await page.goto(account.failureTarget);
          await expect(page).toHaveURL(exact(account.failureTarget));
          await expect(page.locator(ALERT).first(), `${status}: debe mostrarse un mensaje de error`).toBeVisible();
          const retry = page.getByRole('button', { name: RETRY }).first();
          await expect(retry, `${status}: debe ofrecer «Reintentar»`).toBeVisible();
          const afterLoad = calls;
          expect(afterLoad, `${status}: la pantalla debe haber llamado a la API`).toBeGreaterThan(0);
          // Ventana fija para detectar reintentos automáticos sin fin.
          await page.waitForTimeout(4_000);
          expect(calls, `${status}: no debe haber reintentos automáticos (ciclo)`).toBe(afterLoad);
          await capture(page, testInfo, `${account.slug}-falla-${status}`);
        } finally {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
        await page.getByRole('button', { name: RETRY }).first().click();
        await expect(page.locator(ALERT), `${status}: al volver la API, «Reintentar» debe recuperar la pantalla`).toHaveCount(0);
        await expect(page.locator('main h1, .page-header h1').first()).toBeVisible();
      });
    }

    test('barra inferior móvil: máximo cuatro accesos', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await login(page, account);
      const items = page.locator('nav.bottom-nav a');
      await expect(items.first(), 'la barra inferior debe verse a 375 px').toBeVisible();
      const count = await items.count();
      expect(count, 'la barra inferior admite máximo cuatro accesos (más «Más»)').toBeLessThanOrEqual(4);
      await capture(page, testInfo, `${account.slug}-movil`);
    });

    // Issue #53 (E2-S2-D1): los rótulos largos usan shortLabel en role-navigation.ts.
    test('barra inferior móvil: rótulos completos', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await login(page, account);
      await expect(page.locator('nav.bottom-nav a').first()).toBeVisible();
      const truncated = await page.locator('nav.bottom-nav a').evaluateAll((as) => as
        .map((a) => {
          const label = (a.querySelector('span:not([aria-hidden])') ?? a) as HTMLElement;
          // Con text-overflow: ellipsis el navegador dibuja el texto ya recortado, así que se mide
          // el ancho natural en una copia fuera de pantalla y se compara con la caja visible.
          const probe = label.cloneNode(true) as HTMLElement;
          Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', width: 'auto', maxWidth: 'none', overflow: 'visible', whiteSpace: 'nowrap' });
          label.parentElement!.appendChild(probe);
          const natural = probe.getBoundingClientRect().width;
          probe.remove();
          return { text: label.textContent?.trim() ?? '', cut: natural > label.getBoundingClientRect().width + 0.25 };
        })
        .filter((l) => l.cut)
        .map((l) => l.text));
      expect(truncated, 'ningún rótulo de la barra inferior debe cortarse').toEqual([]);
    });
  });
}
