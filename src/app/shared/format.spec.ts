import {
  CryptographicSourceUnavailableError,
  date,
  dateTime,
  errorMessage,
  generateUuid,
  initials,
  money,
  month,
  relative,
  toLocalInput
} from './format';

describe('formato en español de Colombia', () => {
  it('escribe pesos colombianos sin decimales', () => {
    expect(money(2800000).replace(/\s/g, ' ')).toMatch(/\$\s?2\.800\.000/);
    expect(money(null)).toBe('Sin precio');
  });

  it('describe plazos relativos en ambos sentidos', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    expect(relative('2026-10-13T09:00:00Z', now)).toBe('hace 3 h');
    expect(relative('2026-10-15T12:00:00Z', now)).toBe('en 2 días');
    expect(relative('2026-10-13T12:00:20Z', now)).toBe('ahora');
  });

  it('muestra la hora de Colombia y no parte "a. m." entre líneas', () => {
    const text = dateTime('2026-10-14T12:00:00Z');
    expect(text).toContain('7:00');
    expect(text).toMatch(/7:00\u00a0a\.\u00a0m\./);
  });

  it('una fecha de contrato sin hora conserva su día', () => {
    expect(date('2026-10-14')).toContain('14');
  });

  it('nombra el mes de un periodo del reporte de gastos', () => {
    expect(month('2026-09')).toContain('septiembre');
  });

  it('produce el valor de un input datetime-local en hora local', () => {
    expect(toLocalInput(new Date(2026, 9, 14, 9, 5))).toBe('2026-10-14T09:05');
  });

  it('saca iniciales legibles', () => {
    expect(initials('Carolina Restrepo Arango')).toBe('CR');
    expect(initials('')).toBe('·');
  });

  it('traduce los códigos de negocio del backend y nunca muestra su mensaje en inglés', () => {
    expect(errorMessage({ status: 409, error: { code: 'FIXER_BUSY', message: 'The fixer already has a visit' } })).toContain('visita confirmada');
    expect(errorMessage({ status: 409, error: { code: 'SOMETHING_NEW', message: 'English text' } }, 'Texto de la pantalla')).toBe('Texto de la pantalla');
    expect(errorMessage({ status: 0 })).toContain('conexión');
    expect(errorMessage({ status: 403 })).toContain('permiso');
  });

  it('escribe importes representados por BigInt sin perder precisión', () => {
    expect(money(BigInt(500000)).replace(/\s/g, ' ')).toMatch(/\$\s?500\.000/);
    expect(money(BigInt('9007199254740993')).replace(/\s/g, ' ')).toMatch(/\$\s?9\.007\.199\.254\.740\.993/);
  });

  it('traduce errores financieros de la integración digital', () => {
    expect(errorMessage({ status: 400, error: { code: 'AMOUNT_NOT_INT64' } })).toContain('número entero');
    expect(errorMessage({ status: 409, error: { code: 'IDEMPOTENCY_CONFLICT' } })).toContain('clave idempotente');
    expect(errorMessage({ status: 400, error: { code: 'INVALID_PERIOD' } })).toContain('periodo de consulta');
    expect(errorMessage({ status: 403, error: { code: 'ACCESS_DENIED' } })).toContain('permiso');
    expect(errorMessage({ status: 400, error: { code: 'PAYMENT_METHOD_REQUIRED' } })).toContain('transferencia digital');
  });

  it('genera UUIDs RFC4122 v4 válidos para claves de idempotencia', () => {
    const uuid1 = generateUuid();
    const uuid2 = generateUuid();
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(uuid1).not.toBe(uuid2);
  });

  it('garantiza unicidad razonable generando múltiples UUIDs sin colisiones', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateUuid());
    }
    expect(set.size).toBe(50);
  });

  it('utiliza getRandomValues si randomUUID no está disponible, generando un UUID v4 válido', () => {
    const originalRandomUuid = globalThis.crypto.randomUUID;
    try {
      (globalThis.crypto as unknown as { randomUUID: unknown }).randomUUID = undefined;
      const uuid = generateUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      (globalThis.crypto as unknown as { randomUUID: unknown }).randomUUID = originalRandomUuid;
    }
  });

  it('falla con CryptographicSourceUnavailableError de forma explícita si no hay CSPRNG disponible', () => {
    const originalCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true
      });
      expect(() => generateUuid()).toThrow(CryptographicSourceUnavailableError);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true
      });
    }
  });
});
