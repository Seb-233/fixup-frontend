import { losslessParse } from './lossless-json';
import { LedgerAmount, LedgerBalance, LedgerFinding, LedgerReconciliation, LedgerScanned, LedgerTotals } from './models';

/**
 * Safety (SAF-01): lectura estricta de la respuesta de conciliación.
 *
 * La pantalla solo puede decir "el libro cuadra" con una corrida completa y bien formada. Una
 * respuesta a la que le falte un campo, o que se contradiga (dice que cuadra pero trae una regla
 * rota o una ecuación que no cierra), se trata como un error: nunca como un libro sin diferencias.
 */
export class LedgerContractError extends Error {
  constructor(detail: string) {
    super(`Respuesta de conciliación fuera de contrato: ${detail}`);
    this.name = 'LedgerContractError';
  }
}

/** Tiempo máximo que la pantalla espera una corrida. El backend corta la suya a los 30 s. */
export const LEDGER_TIMEOUT_MS = 45_000;

const TOTALS: readonly (keyof LedgerTotals)[] = [
  'collected', 'serviceCollected', 'debtCollected', 'earningsGross', 'serviceEarningsGross', 'debtEarningsGross',
  'legacyEarningsGross', 'commission', 'net', 'heldNet', 'availableNet', 'paidOutNet', 'payouts', 'composedPayouts',
  'legacyPayouts', 'payoutEntriesNet', 'legacyPaidOutNet', 'paidDebts', 'outstandingDebts', 'cashAgreed',
  'cashReceived', 'cashOutstanding'
];

const SCANNED: readonly (keyof LedgerScanned)[] = [
  'payments', 'paymentAttempts', 'earnings', 'payouts', 'payoutEntries', 'debts', 'cashSettlements'
];

type Json = Record<string, unknown>;

function record(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new LedgerContractError(`${where} no es un objeto`);
  return value as Json;
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new LedgerContractError(`${where} no es una lista`);
  return value;
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value) throw new LedgerContractError(`${where} no es un texto`);
  return value;
}

function flag(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') throw new LedgerContractError(`${where} no es verdadero o falso`);
  return value;
}

/** Pesos enteros: un `number` exacto o un `bigint`. Un decimal o un entero impreciso no se acepta. */
function amount(value: unknown, where: string): LedgerAmount {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  throw new LedgerContractError(`${where} no es un importe en pesos enteros`);
}

function count(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new LedgerContractError(`${where} no es un conteo`);
  return value;
}

/** Compara importes sin pasar por `number`, para no perder pesos en los montos grandes. */
export function sameAmount(a: LedgerAmount, b: LedgerAmount): boolean {
  return BigInt(a) === BigInt(b);
}

function balance(value: unknown, index: number): LedgerBalance {
  const where = `balances[${index}]`;
  const raw = record(value, where);
  const result: LedgerBalance = {
    code: text(raw['code'], `${where}.code`),
    description: text(raw['description'], `${where}.description`),
    expected: amount(raw['expected'], `${where}.expected`),
    actual: amount(raw['actual'], `${where}.actual`),
    holds: flag(raw['holds'], `${where}.holds`)
  };
  if (result.holds !== sameAmount(result.expected, result.actual)) {
    throw new LedgerContractError(`${where}.holds contradice sus importes`);
  }
  return result;
}

function finding(value: unknown, index: number): LedgerFinding {
  const where = `findings[${index}]`;
  const raw = record(value, where);
  const result: LedgerFinding = {
    code: text(raw['code'], `${where}.code`),
    description: text(raw['description'], `${where}.description`),
    count: count(raw['count'], `${where}.count`),
    sample: list(raw['sample'], `${where}.sample`).map((id, i) => text(id, `${where}.sample[${i}]`))
  };
  if (result.count < 1) throw new LedgerContractError(`${where} no tiene filas`);
  return result;
}

export function parseLedgerReconciliation(body: string): LedgerReconciliation {
  let parsed: unknown;
  try {
    parsed = losslessParse<unknown>(body);
  } catch {
    throw new LedgerContractError('no es JSON');
  }
  const raw = record(parsed, 'la respuesta');

  const checkedAt = text(raw['checkedAt'], 'checkedAt');
  if (Number.isNaN(Date.parse(checkedAt))) throw new LedgerContractError('checkedAt no es una fecha');

  const rawTotals = record(raw['totals'], 'totals');
  const totals = Object.fromEntries(TOTALS.map((key) => [key, amount(rawTotals[key], `totals.${key}`)])) as unknown as LedgerTotals;

  const rawScanned = record(raw['scanned'], 'scanned');
  const scanned = Object.fromEntries(SCANNED.map((key) => [key, count(rawScanned[key], `scanned.${key}`)])) as unknown as LedgerScanned;

  const balances = list(raw['balances'], 'balances').map(balance);
  const findings = list(raw['findings'], 'findings').map(finding);
  const consistent = flag(raw['consistent'], 'consistent');
  const balanced = flag(raw['balanced'], 'balanced');

  if (!balances.length) throw new LedgerContractError('no trae ninguna ecuación');
  if (balanced !== balances.every((b) => b.holds)) throw new LedgerContractError('balanced contradice las ecuaciones');
  if (consistent !== (balanced && findings.length === 0)) {
    throw new LedgerContractError('consistent contradice las ecuaciones o las reglas');
  }

  return { checkedAt, consistent, balanced, totals, scanned, balances, findings };
}

/** Total de filas leídas en la corrida; cero significa que el libro está vacío. */
export function rowsScanned(scanned: LedgerScanned): number {
  return SCANNED.reduce((sum, key) => sum + scanned[key], 0);
}

export type LedgerFailureKind =
  | 'unreadable'
  | 'busy'
  | 'timeout'
  | 'offline'
  | 'forbidden'
  | 'session'
  | 'contract'
  | 'unavailable';

export interface LedgerFailure {
  kind: LedgerFailureKind;
  title: string;
  message: string;
  retryable: boolean;
}

const FAILURES: Record<LedgerFailureKind, Omit<LedgerFailure, 'kind'>> = {
  unreadable: {
    title: 'No se pudo leer el libro de pagos',
    message: 'El servidor no logró revisar todas las filas, así que no hay resultado. Esto no quiere decir que el libro cuadre.',
    retryable: true
  },
  busy: {
    title: 'Ya hay una conciliación en curso',
    message: 'Otra corrida está revisando el libro en este momento. Espera unos segundos y vuelve a intentarlo.',
    retryable: true
  },
  timeout: {
    title: 'La conciliación tardó demasiado',
    message: 'No llegó respuesta a tiempo, así que no hay resultado. Vuelve a intentarlo.',
    retryable: true
  },
  offline: {
    title: 'No hay conexión con el servidor',
    message: 'No se pudo pedir la conciliación. Revisa tu conexión e inténtalo de nuevo.',
    retryable: true
  },
  forbidden: {
    title: 'Tu cuenta no puede ver la conciliación',
    message: 'Solo la administración de la plataforma puede consultar el libro de pagos.',
    retryable: false
  },
  session: {
    title: 'Tu sesión terminó',
    message: 'Vuelve a ingresar para consultar la conciliación.',
    retryable: false
  },
  contract: {
    title: 'La respuesta de la conciliación no se pudo interpretar',
    message: 'El servidor respondió algo incompleto o contradictorio, así que no se muestra ningún resultado.',
    retryable: true
  },
  unavailable: {
    title: 'No se pudo conciliar el libro',
    message: 'El servidor no entregó un resultado. Vuelve a intentarlo en un momento.',
    retryable: true
  }
};

function errorCode(body: unknown): string | null {
  // La conciliación se pide como texto para no perder montos grandes, así que el cuerpo del error
  // también llega como texto.
  let parsed = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const code = (parsed as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

function kindOf(error: unknown): LedgerFailureKind {
  if (error instanceof LedgerContractError) return 'contract';
  const failure = error as { name?: string; status?: number; error?: unknown } | null;
  if (failure?.name === 'TimeoutError') return 'timeout';
  switch (failure?.status) {
    case 0:
      return 'offline';
    case 401:
      return 'session';
    case 403:
      return 'forbidden';
    case 504:
      return 'timeout';
    case 503: {
      const code = errorCode(failure.error);
      if (code === 'LEDGER_UNREADABLE') return 'unreadable';
      if (code === 'LEDGER_RECONCILIATION_BUSY') return 'busy';
      return 'unavailable';
    }
    default:
      return 'unavailable';
  }
}

export function ledgerFailure(error: unknown): LedgerFailure {
  const kind = kindOf(error);
  return { kind, ...FAILURES[kind] };
}
