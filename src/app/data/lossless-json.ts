// Utilidades para preservación exacta de enteros de 64 bits (int64) en JSON.
// JavaScript Number pierde precisión a partir de Number.MAX_SAFE_INTEGER (9007199254740991).
// Esta utilidad garantiza que los importes financieros no se redondeen al deserializar
// ni se serialicen como string si el backend espera un token numérico JSON canónico.

const BIGINT_SENTINEL = '__FIXUP_BIGINT__';
const BIGINT_LITERAL_SENTINEL = '__FIXUP_BIGINT_LITERAL__';

/**
 * Convierte un valor a token int64 adecuado (number seguro o BigInt) sin alterar el valor.
 */
export function toInt64Token(amount: number | bigint | string): number | bigint {
  if (typeof amount === 'bigint') return amount;
  if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new Error(`Amount must be an integer: ${amount}`);
    }
    return amount;
  }
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`Invalid int64 string: ${amount}`);
    }
    const b = BigInt(trimmed);
    if (b >= BigInt(Number.MIN_SAFE_INTEGER) && b <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(b);
    }
    return b;
  }
  throw new Error(`Cannot convert ${typeof amount} to int64`);
}

/**
 * Serializa un objeto preservando BigInts como tokens numéricos JSON sin comillas.
 */
export function losslessStringify(value: unknown): string {
  const json = JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') {
      return `${BIGINT_LITERAL_SENTINEL}${val.toString()}`;
    }
    return val;
  });
  if (!json) return json;
  return json.replace(new RegExp(`"${BIGINT_LITERAL_SENTINEL}(-?\\d+)"`, 'g'), '$1');
}

/**
 * Parsea un texto JSON preservando enteros que exceden Number.MAX_SAFE_INTEGER como BigInt.
 * No altera strings que contengan números ni números con decimales.
 */
export function losslessParse<T = unknown>(text: string): T {
  if (typeof text !== 'string') return text as unknown as T;

  let inString = false;
  let escape = false;
  let result = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    const char = text[i];

    if (inString) {
      result += char;
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      i++;
      continue;
    }

    // Posible inicio de número si le precede ':' o '[' o ',' o inicio de texto
    if (char === '-' || (char >= '0' && char <= '9')) {
      const prev = result.trimEnd().slice(-1);
      if (prev === ':' || prev === '[' || prev === ',' || prev === '' || result.length === 0) {
        let j = i;
        if (text[j] === '-') j++;
        while (j < n && text[j] >= '0' && text[j] <= '9') {
          j++;
        }
        const isDecimal = j < n && (text[j] === '.' || text[j] === 'e' || text[j] === 'E');
        if (!isDecimal) {
          const numStr = text.substring(i, j);
          if (numStr.length >= 15) {
            try {
              const b = BigInt(numStr);
              if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER)) {
                result += `"${BIGINT_SENTINEL}${numStr}"`;
                i = j;
                continue;
              }
            } catch {
              // Continuar
            }
          }
        }
      }
    }

    result += char;
    i++;
  }

  return JSON.parse(result, (_key, value) => {
    if (typeof value === 'string' && value.startsWith(BIGINT_SENTINEL)) {
      return BigInt(value.substring(BIGINT_SENTINEL.length));
    }
    return value;
  });
}
