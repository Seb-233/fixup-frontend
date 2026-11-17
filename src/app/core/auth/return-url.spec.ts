import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('acepta rutas internas y conserva su query (el ?id= del regreso de Wompi)', () => {
    expect(safeReturnUrl('/payments/pay-1?id=12077206-1-2')).toBe('/payments/pay-1?id=12077206-1-2');
    expect(safeReturnUrl('/administration/wompi-transactions')).toBe('/administration/wompi-transactions');
  });

  it.each([
    ['//evil.example/payments', 'otro origen'],
    ['/\\\\evil.example', 'barra invertida que el navegador trata como //'],
    ['/%2F%2Fevil.example', 'barras codificadas'],
    ['/%5Cevil.example', 'barra invertida codificada'],
    ['https://evil.example/payments/1', 'URL absoluta'],
    ['javascript:alert(1)', 'esquema'],
    ['payments/1', 'ruta relativa'],
    [' /payments/1', 'espacio inicial'],
    ['/payments/1\nSet-Cookie: x', 'caracteres de control'],
    ['/auth/login?returnUrl=/x', 'pantalla de ingreso'],
    ['/auth', 'pantalla de ingreso'],
    ['/', 'inicio'],
    ['', 'vacío'],
    [`/${'a'.repeat(2048)}`, 'demasiado largo']
  ])('rechaza %s (%s)', (candidate) => {
    expect(safeReturnUrl(candidate)).toBeNull();
  });

  it('rechaza valores que no son texto', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
