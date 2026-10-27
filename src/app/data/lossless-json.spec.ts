import { describe, expect, it } from 'vitest';
import { losslessParse, losslessStringify, toInt64Token } from './lossless-json';

describe('Lossless JSON for int64', () => {
  it('preserva números mayores a Number.MAX_SAFE_INTEGER sin pérdida de precisión', () => {
    // 9007199254740991 es MAX_SAFE_INTEGER. 9007199254740993 en JSON.parse normal se redondearía a 9007199254740992
    const rawJson = '{"paymentId":"pay-123","amount":9007199254740993,"description":"Pago de gran escala"}';
    const parsed = losslessParse<{ paymentId: string; amount: bigint | number; description: string }>(rawJson);

    expect(typeof parsed.amount).toBe('bigint');
    expect(parsed.amount.toString()).toBe('9007199254740993');
    expect(parsed.description).toBe('Pago de gran escala');
  });

  it('preserva números negativos menores a Number.MIN_SAFE_INTEGER', () => {
    const rawJson = '{"delta":-9007199254740995}';
    const parsed = losslessParse<{ delta: bigint | number }>(rawJson);

    expect(typeof parsed.delta).toBe('bigint');
    expect(parsed.delta.toString()).toBe('-9007199254740995');
  });

  it('mantiene números seguros en rango estándar como Number', () => {
    const rawJson = '{"amount":185000,"rate":10.5,"count":3}';
    const parsed = losslessParse<{ amount: number; rate: number; count: number }>(rawJson);

    expect(typeof parsed.amount).toBe('number');
    expect(parsed.amount).toBe(185000);
    expect(parsed.rate).toBe(10.5);
    expect(parsed.count).toBe(3);
  });

  it('no altera cadenas que contengan dígitos idénticos a números grandes', () => {
    const rawJson = '{"code":"9007199254740993","nested":{"ref":"REF-9007199254740993"}}';
    const parsed = losslessParse<{ code: string; nested: { ref: string } }>(rawJson);

    expect(parsed.code).toBe('9007199254740993');
    expect(typeof parsed.code).toBe('string');
    expect(parsed.nested.ref).toBe('REF-9007199254740993');
  });

  it('serializa BigInt como un token numérico JSON no entrecomillado', () => {
    const payload = {
      reference: 'REF-XYZ',
      amount: 9007199254740993n,
      instrument: 'SANDBOX_CARD'
    };

    const json = losslessStringify(payload);
    // Debe producir exactamente el token numérico sin comillas
    expect(json).toBe('{"reference":"REF-XYZ","amount":9007199254740993,"instrument":"SANDBOX_CARD"}');
    // Verifica que no tenga comillas alrededor del número
    expect(json).not.toContain('"amount":"9007199254740993"');
  });

  it('serializa números estándar normalmente', () => {
    const payload = {
      reference: 'REF-NORMAL',
      amount: 150000,
      instrument: 'SANDBOX_PSE'
    };

    const json = losslessStringify(payload);
    expect(json).toBe('{"reference":"REF-NORMAL","amount":150000,"instrument":"SANDBOX_PSE"}');
  });

  it('toInt64Token valida y convierte correctamente números y cadenas enteras', () => {
    expect(toInt64Token(185000)).toBe(185000);
    expect(toInt64Token(9007199254740993n)).toBe(9007199254740993n);
    expect(toInt64Token('185000')).toBe(185000);
    expect(toInt64Token('9007199254740993')).toBe(9007199254740993n);
    expect(() => toInt64Token(12.34)).toThrow('Amount must be an integer');
    expect(() => toInt64Token('abc')).toThrow('Invalid int64 string');
  });
});
