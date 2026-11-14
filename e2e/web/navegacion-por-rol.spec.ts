import { test, expect, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// E2-S2 · Validar navegación y errores por rol.
// Recorre el menú completo de cada rol en escritorio, la barra inferior en móvil, rutas de otros roles,
// rutas inexistentes, enlaces viejos de notificaciones y fallas simuladas del servidor (500 y 503).
// Los resultados y capturas van a test-results/ (ignorado por git) salvo que NAV_OUT indique otra carpeta.
const OUT = process.env.NAV_OUT ?? path.resolve('test-results/navegacion-por-rol');
fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });

const API = /^\/(auth|payments|requests|quotations|jobs|media|fixers|properties|locations|contracts|notifications|remodelings|administration|management|visits|ratings|analytics)(\/|$|\?)/;

type Role = 'OWNER' | 'TENANT' | 'FIXER' | 'REAL_ESTATE_MANAGER' | 'PLATFORM_ADMIN';
const ACCOUNTS: { role: Role; name: string; slug: string; foreign: string[] }[] = [
  { role: 'OWNER', name: 'Carolina Restrepo Arango', slug: 'propietario', foreign: ['/administration/sla-board', '/requests/inbox', '/jobs/me'] },
  { role: 'TENANT', name: 'Andrés Moreno Rincón', slug: 'arrendatario', foreign: ['/properties', '/payments', '/management'] },
  { role: 'FIXER', name: 'Jhon Fredy Cárdenas Ospina', slug: 'tecnico', foreign: ['/properties', '/administration/fixer-review', '/expenses'] },
  { role: 'REAL_ESTATE_MANAGER', name: 'Inmobiliaria Cordillera', slug: 'inmobiliaria', foreign: ['/administration/sla-board', '/jobs/me', '/fixers/portfolio'] },
  { role: 'PLATFORM_ADMIN', name: 'Soporte Fix&Rent', slug: 'administrador', foreign: ['/requests/new', '/payments/earnings', '/properties/new'] }
];

interface PageCheck { href: string; label: string; finalUrl: string; h1: string; alerts: string[]; apiErrors: string[]; consoleErrors: string[]; ms: number; ok: boolean }
const report: Record<string, unknown> = { fecha: new Date().toISOString(), roles: {} };

function watch(page: Page, appOrigin: string) {
  const apiErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === appOrigin && API.test(u.pathname) && r.status() >= 400) apiErrors.push(`${r.status()} ${r.request().method()} ${u.pathname}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  return {
    take() {
      const out = { apiErrors: [...apiErrors], consoleErrors: [...consoleErrors] };
      apiErrors.length = 0; consoleErrors.length = 0;
      return out;
    }
  };
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.locator('button.demo-row', { hasText: name }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await settle(page);
}

async function visibleAlerts(page: Page) {
  return page.locator('.alert-danger:visible, .error:visible').allInnerTexts();
}

for (const account of ACCOUNTS) {
  test(`navegación y errores · ${account.slug}`, async ({ page }) => {
    test.setTimeout(240000);
    const w = watch(page, new URL(test.info().project.use.baseURL ?? 'http://localhost:4200').origin);
    const roleReport: Record<string, unknown> = {};
    (report.roles as Record<string, unknown>)[account.role] = roleReport;

    // 1. Escritorio: todo el menú lateral.
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, account.name);
    w.take();
    const links = await page.locator('aside.sidebar nav a').evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute('href') ?? '', label: (a.textContent ?? '').replace(/\s+/g, ' ').trim() })));
    const pages: PageCheck[] = [];
    for (const link of links) {
      const t0 = Date.now();
      await page.locator(`aside.sidebar nav a[href="${link.href}"]`).first().click();
      await settle(page);
      const ms = Date.now() - t0;
      const finalUrl = new URL(page.url()).pathname;
      const h1 = (await page.locator('main h1, .page-header h1').first().textContent().catch(() => ''))?.trim() ?? '';
      const alerts = await visibleAlerts(page);
      const { apiErrors, consoleErrors } = w.take();
      const ok = finalUrl === link.href && h1.length > 0 && alerts.length === 0 && apiErrors.length === 0;
      pages.push({ ...link, finalUrl, h1, alerts, apiErrors, consoleErrors, ms, ok });
      const shot = `${account.slug}-${link.href.replace(/^\//, '').replace(/\//g, '_') || 'inicio'}.jpg`;
      await page.screenshot({ path: path.join(OUT, 'capturas', shot), type: 'jpeg', quality: 70 });
    }
    roleReport['menu'] = pages;

    // 2. Rutas de otros roles: deben llevar a "Acceso denegado", nunca mostrar datos.
    const foreign = [];
    for (const href of account.foreign) {
      await page.goto(href);
      await settle(page);
      const finalUrl = new URL(page.url()).pathname;
      const { apiErrors } = w.take();
      foreign.push({ href, finalUrl, apiErrors, ok: finalUrl === '/auth/access-denied' });
    }
    roleReport['rutasAjenas'] = foreign;
    await page.screenshot({ path: path.join(OUT, 'capturas', `${account.slug}-acceso-denegado.jpg`), type: 'jpeg', quality: 70 });

    // 3. Ruta inexistente y enlace viejo de notificación.
    await page.goto('/esta-ruta-no-existe');
    await settle(page);
    const unknown = new URL(page.url()).pathname;
    await page.goto('/visits/00000000-0000-0000-0000-000000000000');
    await settle(page);
    const legacy = new URL(page.url()).pathname;
    w.take();
    roleReport['rutaInexistente'] = { destino: unknown, ok: unknown === '/dashboard' };
    roleReport['enlaceViejoNotificacion'] = { origen: '/visits/:id', destino: legacy, ok: legacy === '/visits' || legacy === '/auth/access-denied' };

    // 4. Falla del servidor: la primera pantalla del menú con la API respondiendo 500 y después 503.
    const target = links.find((l) => l.href !== '/dashboard')!;
    const failures = [];
    for (const status of [500, 503]) {
      let calls = 0;
      await page.route((u) => API.test(u.pathname) && !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/notifications'), (route) => {
        if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
        calls++;
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status, error: 'simulado', code: 'SIMULATED_FAILURE', message: 'Falla simulada' }) });
      });
      await page.goto(target.href);
      await settle(page);
      const callsAfterLoad = calls;
      await page.waitForTimeout(4000);
      const callsAfterWait = calls; // si sigue subiendo, hay un ciclo de reintentos
      const alerts = await visibleAlerts(page);
      const retry = page.getByRole('button', { name: /reintentar|volver a intentar/i }).first();
      const hasRetry = await retry.isVisible().catch(() => false);
      await page.screenshot({ path: path.join(OUT, 'capturas', `${account.slug}-falla-${status}.jpg`), type: 'jpeg', quality: 70 });
      await page.unrouteAll({ behavior: "ignoreErrors" });
      let recovered = false;
      if (hasRetry) {
        await retry.click();
        await settle(page);
        recovered = (await visibleAlerts(page)).length === 0;
      }
      w.take();
      failures.push({ status, pagina: target.href, alertas: alerts, botonReintentar: hasRetry, recupera: recovered, llamadasAlCargar: callsAfterLoad, llamadas4sDespues: callsAfterWait, sinCiclo: callsAfterWait === callsAfterLoad, ok: alerts.length > 0 && callsAfterWait === callsAfterLoad });
    }
    roleReport['fallasServidor'] = failures;

    // 5. Móvil (375 px): barra inferior con máximo cuatro accesos y rótulos completos.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await settle(page);
    const readBar = () => page.locator('nav.bottom-nav a').evaluateAll((as) => as.map((a) => {
      const label = (a.querySelector('span:not([aria-hidden])') ?? a) as HTMLElement;
      return { href: a.getAttribute('href'), texto: label.textContent?.trim(), truncado: label.scrollWidth > label.clientWidth + 1 };
    }));
    const bottomAlCargar = await readBar();
    await page.waitForTimeout(3000);
    const bottom = await readBar();
    roleReport['barraMovilAlCargar'] = bottomAlCargar;
    await page.screenshot({ path: path.join(OUT, 'capturas', `${account.slug}-movil.jpg`), type: 'jpeg', quality: 70 });
    roleReport['barraMovil'] = { accesos: bottom, ok: bottom.length <= 4 && bottom.every((b) => !b.truncado) };
    fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(report, null, 2));
  });
}
