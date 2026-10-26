import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8080';

// Helper para llamadas auxiliares directas al backend real
async function getDemoToken(role: string, sub?: string, name?: string): Promise<string> {
  const params = new URLSearchParams({ role });
  if (sub) params.set('sub', sub);
  if (name) params.set('name', name);
  const res = await fetch(`${BACKEND_URL}/demo/token?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to get demo token: ${res.status}`);
  const json = await res.json();
  return json.accessToken;
}

test.describe.serial('Certificación de Navegador Real — Fix&Rent (FRONT-03C)', () => {
  let createdRequestId: string = '';
  let paymentId: string = '';

  test('1. Pantalla de inicio de sesión (/login)', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Fix&Rent/);
    await expect(page.locator('#login-title')).toContainText('Ingresa a tu cuenta');
    await expect(page.locator('#demo-title')).toContainText('Cuentas de demostración');

    // Verificar las 5 cuentas de demostración legítimas
    const demoList = page.locator('ul.list li');
    await expect(demoList).toHaveCount(5);
    await expect(page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' })).toBeVisible();
    await expect(page.locator('button.demo-row', { hasText: 'Jhon Fredy Cárdenas Ospina' })).toBeVisible();
    await expect(page.locator('button.demo-row', { hasText: 'Andrés Moreno Rincón' })).toBeVisible();
    await expect(page.locator('button.demo-row', { hasText: 'Inmobiliaria Cordillera' })).toBeVisible();
    await expect(page.locator('button.demo-row', { hasText: 'Soporte Fix&Rent' })).toBeVisible();
  });

  test('2. Acceso autenticado mediante mecanismo demo legítimo', async ({ page }) => {
    await page.goto('/login');
    const ownerBtn = page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' });
    await expect(ownerBtn).toBeVisible();
    await ownerBtn.click();

    // Debe autenticar contra el backend real y redirigir al dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('.page-header h1')).toContainText('Carolina');
  });

  test('3. Navegación por roles de Propietario', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    // Enlaces de navegación de propietario en la barra lateral
    const nav = page.locator('aside.sidebar nav');
    await expect(nav.locator('a[href="/properties"]')).toBeVisible();
    await expect(nav.locator('a[href="/requests"]')).toBeVisible();
    await expect(nav.locator('a[href="/payments"]')).toBeVisible();
    await expect(nav.locator('a[href="/expenses"]')).toBeVisible();

    // Navegar a Inmuebles
    await nav.locator('a[href="/properties"]').click();
    await page.waitForURL('**/properties');
    await expect(page.locator('h1')).toContainText(/inmuebles/i);

    // Navegar a Pagos
    await page.locator('aside.sidebar nav a[href="/payments"]').click();
    await page.waitForURL('**/payments');
    await expect(page.locator('h1')).toContainText(/pagos/i);
    await expect(page.locator('.alert-info')).toContainText('Consulta autoritativa');
  });

  test('4. Creación de solicitud digital 100 % digital', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/requests/new');
    await expect(page.locator('h1')).toContainText(/Reportar un daño/i);

    // Seleccionar primer inmueble disponible
    const propertySelect = page.locator('select#property');
    await expect(propertySelect).toBeVisible();
    await propertySelect.selectOption({ index: 1 });

    // Completar título y descripción
    const uniqueTitle = `Fuga de agua en lavaplatos ${Date.now()}`;
    await page.locator('input#title').fill(uniqueTitle);
    await page.locator('textarea#description').fill('Tubería rota bajo lavamanos con goteo constante y filtración activa.');

    // Seleccionar urgencia Alta mediante el label correspondiente
    await page.locator('label', { hasText: 'Alta' }).click();

    // Verificar aviso 100 % digital
    await expect(page.locator('p', { hasText: 'Pago 100 % digital' })).toBeVisible();

    // Enviar solicitud
    await page.locator('button[type="submit"]', { hasText: 'Enviar solicitud' }).click();

    // Debe redirigir al detalle de la solicitud creada (diferente a /requests/new)
    await page.waitForURL(
      (url) => url.pathname.startsWith('/requests/') && url.pathname !== '/requests/new',
      { timeout: 15000 }
    );
    await expect(page.locator('h1')).toContainText(uniqueTitle);
    await expect(page.locator('app-status, .chip').first()).toContainText(/Recibiendo cotizaciones|Abierta|OPEN/i);

    // Guardar el requestId creado para los siguientes pasos
    createdRequestId = page.url().split('/').pop() || '';
    expect(createdRequestId).not.toBe('new');
    expect(createdRequestId).toBeTruthy();
  });

  test('5. Aceptación de cotización y navegación al checkout', async ({ page }) => {
    expect(createdRequestId).toBeTruthy();

    // Técnico envía cotización sobre la solicitud real en el backend
    const fixerToken = await getDemoToken('FIXER', 'auth0|demo-fixer', 'Jhon Fredy Cárdenas Ospina');
    const quoteRes = await fetch(`${BACKEND_URL}/quotations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fixerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId: createdRequestId,
        amount: 250000,
        estimatedDays: 2,
        message: 'Reparación con materiales incluidos y sellado.'
      })
    });
    expect(quoteRes.ok).toBe(true);

    // Propietario abre la solicitud en el navegador
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(`/requests/${createdRequestId}`);
    await expect(page.locator('li.quote', { hasText: 'Jhon Fredy Cárdenas' })).toBeVisible({ timeout: 15000 });

    // Aceptar la cotización en pantalla con el botón 'Elegir a Jhon'
    const acceptBtn = page.locator('button', { hasText: /Elegir a/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Debe navegar automáticamente al checkout
    await page.waitForURL(
      (url) => url.pathname.startsWith('/payments/') && url.pathname !== '/payments',
      { timeout: 15000 }
    );
    await expect(page.locator('h1')).toContainText(/Pasarela de pago digital/i);
    await expect(page.locator('.price').first()).toContainText(/250\.000/);

    paymentId = page.url().split('/').pop() || '';
    expect(paymentId).toBeTruthy();
  });

  test('6. Pago sandbox y estado oficial en pasarela', async ({ page }) => {
    expect(paymentId).toBeTruthy();

    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(`/payments/${paymentId}`);
    await expect(page.locator('.price').first()).toContainText(/250\.000/);

    // Abrir formulario de pago si no está abierto
    const payBtn = page.locator('button', { hasText: /Pagar \$|Pagar/i });
    if (await payBtn.isVisible()) {
      await payBtn.click();
    }

    // Seleccionar tarjeta sandbox
    const instrumentSelect = page.locator('select#instrument');
    await expect(instrumentSelect).toBeVisible();
    await instrumentSelect.selectOption('SANDBOX_CARD');

    // Confirmar pago simulado
    const confirmBtn = page.locator('button[type="submit"]', { hasText: /Confirmar pago simulado/i });
    await confirmBtn.click();

    // Verificar que el estado cambie a APPROVED ('Pagado')
    await expect(page.locator('app-status, .chip').first()).toContainText(/Pagado|APPROVED/i, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/el trabajo ya quedó abierto/i);
  });

  test('7. Navegación hacia el trabajo abierto', async ({ page }) => {
    expect(createdRequestId).toBeTruthy();

    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(`/requests/${createdRequestId}`);
    // Verificar que la solicitud ahora refleja el técnico asignado y el trabajo activo
    await expect(page.locator('app-status, .chip').first()).toContainText(/Técnico asignado|ASSIGNED/i);
    await expect(page.locator('body')).toContainText(/Jhon Fredy Cárdenas/);
  });

  test('8. Chat activo, cierre de trabajo y modo solo lectura', async ({ page }) => {
    expect(createdRequestId).toBeTruthy();

    // 8.1 Propietario accede a la conversación activa
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto(`/requests/${createdRequestId}/messages`);
    await expect(page.locator('h1')).toContainText('Conversación');

    // Enviar mensaje
    const textarea = page.locator('textarea#message');
    await expect(textarea).toBeVisible();
    await textarea.fill('Hola técnico, confirmado el acceso para la reparación.');
    await page.locator('button[type="submit"]', { hasText: 'Enviar' }).click();

    // El mensaje debe aparecer en el hilo
    await expect(page.locator('.bubble', { hasText: 'confirmado el acceso para la reparación' })).toBeVisible({ timeout: 10000 });

    // 8.2 Ciclo de trabajo completo en backend: programar, iniciar y finalizar
    const fixerToken = await getDemoToken('FIXER', 'auth0|demo-fixer', 'Jhon Fredy Cárdenas Ospina');
    const jobRes = await fetch(`${BACKEND_URL}/jobs/for-request/${createdRequestId}`, {
      headers: { Authorization: `Bearer ${fixerToken}` }
    });
    const jobJson = await jobRes.json();
    const jobId = jobJson.job ? jobJson.job.id : jobJson.id;

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    await fetch(`${BACKEND_URL}/jobs/${jobId}/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor: futureDate })
    });
    await fetch(`${BACKEND_URL}/jobs/${jobId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Iniciando trabajo' })
    });
    const completeRes = await fetch(`${BACKEND_URL}/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Obra terminada con sellado definitivo.' })
    });
    expect(completeRes.ok).toBe(true);

    // 8.3 Recargar chat en el navegador y verificar modo solo lectura
    await page.reload();
    await expect(page.locator('.alert-info')).toContainText(/modo de solo lectura/i, { timeout: 10000 });
    await expect(page.locator('textarea#message')).not.toBeVisible();
  });

  test('9. Listado autoritativo de pagos desde el backend (/payments)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/payments');
    await expect(page.locator('h1')).toContainText(/pagos/i);

    // La tabla de pagos debe estar poblada autoritativamente
    const rows = page.locator('table.table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Verificar datos en las columnas
    await expect(rows.first().locator('td[data-label="Referencia"]')).toBeVisible();
    await expect(rows.first().locator('td[data-label="Valor"]')).toContainText(/\$/);
  });

  test('10. Recuperación del listado tras recargar y filtrado', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/payments');
    await expect(page.locator('table.table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Recarga de página completa
    await page.reload();
    await expect(page.locator('table.table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Filtrar por Aprobados
    await page.locator('select#status-filter').selectOption('APPROVED');
    await page.waitForTimeout(600);
    const approvedRows = page.locator('table.table tbody tr');
    const approvedCount = await approvedRows.count();
    expect(approvedCount).toBeGreaterThan(0);

    // Primer registro filtrado debe tener badge Aprobado ('Pagado')
    await expect(approvedRows.first().locator('td[data-label="Estado"]')).toContainText(/Pagado|APPROVED/i);
  });

  test('11. Feed público de portafolios de técnicos', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    // Desplazarse hacia la sección de ideas de remodelación
    const ideasSection = page.locator('section.ideas');
    await expect(ideasSection).toBeVisible({ timeout: 15000 });
    await ideasSection.scrollIntoViewIfNeeded();
    await expect(page.locator('#ideas-title')).toContainText('Ideas para tu casa');

    // Debe contener tarjetas con fotos
    const cards = page.locator('ul.feed li button.card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Hacer clic en la primera tarjeta para abrir modal
    await cards.first().click();
    const dialog = page.locator('dialog.dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('a.btn-primary')).toContainText('Pedir algo parecido');

    // Cerrar diálogo con tecla Escape
    await page.keyboard.press('Escape');
  });

  test('12. Presentación de ingresos y gastos', async ({ page }) => {
    // 12.1 Gastos de Propietario
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Carolina Restrepo Arango' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/expenses');
    await expect(page.locator('h1')).toContainText('Reporte de gastos');
    await expect(page.locator('body')).toContainText(/Total del periodo|Gastos|Pagos/i);

    // 12.2 Ingresos de Técnico
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/login');
    await page.locator('button.demo-row', { hasText: 'Jhon Fredy Cárdenas Ospina' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/payments/earnings');
    await expect(page.locator('h1')).toContainText('Mis ingresos');
    await expect(page.locator('dt', { hasText: /Disponible para retirar/i })).toBeVisible();
    await expect(page.locator('dt', { hasText: /Retenido/i })).toBeVisible();
  });
});
