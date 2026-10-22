import { date, dateTime, errorMessage, initials, money, month, relative, toLocalInput } from './format';

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

  it('explica el bloqueo por un saldo pendiente de un trabajo en efectivo', () => {
    const text = errorMessage({ status: 409, error: { code: 'OWNER_HAS_OUTSTANDING_DEBT' } });
    expect(text).toContain('saldo pendiente');
    expect(text).toContain('Pagos');
  });
});
