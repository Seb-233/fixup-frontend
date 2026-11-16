import { defineConfig } from '@playwright/test';

// El navegador se puede cambiar sin tocar este archivo ni la línea de comandos de las pruebas:
//
//   PLAYWRIGHT_CHANNEL=msedge     → Microsoft Edge, que ya viene instalado en Windows
//   PLAYWRIGHT_CHANNEL=chromium   → el Chromium que Playwright trae consigo, sin depender de
//                                   ningún navegador del sistema (npx playwright install chromium)
//
// Por omisión sigue siendo Chrome, así que el CI y quien no defina nada se comportan igual que
// antes. Existe porque no todas las máquinas del equipo tienen Chrome en la ruta estándar y la
// suite completa quedaba inservible por eso.
const CANAL = process.env.PLAYWRIGHT_CHANNEL ?? 'chrome';
const navegador = CANAL === 'chromium' || CANAL === '' ? {} : { channel: CANAL };

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    ...navegador,
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Sin reintentos, 'on-first-retry' nunca guardaría nada: se conserva la traza de cada fallo.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Apagado salvo que se pida. PLAYWRIGHT_VIDEO=on graba la corrida completa, que sirve como
    // respaldo para una demostración en vivo: si el ambiente no levanta, se muestra el video.
    video: (process.env.PLAYWRIGHT_VIDEO as 'on' | 'off' | 'retain-on-failure' | undefined) ?? 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...navegador }
    }
  ]
});
