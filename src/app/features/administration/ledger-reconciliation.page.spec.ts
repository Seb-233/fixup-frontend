import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, TimeoutError } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { LedgerContractError } from '../../data/ledger-reconciliation';
import { LedgerReconciliation, LedgerTotals } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { LedgerReconciliationPage } from './ledger-reconciliation.page';

describe('LedgerReconciliationPage (SAF-01)', () => {
  let fixture: ComponentFixture<LedgerReconciliationPage>;
  let responses: Subject<LedgerReconciliation>;
  let calls: number;

  const totals: LedgerTotals = {
    collected: 450000,
    serviceCollected: 400000,
    debtCollected: 50000,
    earningsGross: 450000,
    serviceEarningsGross: 400000,
    debtEarningsGross: 50000,
    legacyEarningsGross: 0,
    commission: 45000,
    net: 405000,
    heldNet: 405000,
    availableNet: 0,
    paidOutNet: 0,
    payouts: 0,
    composedPayouts: 0,
    legacyPayouts: 0,
    payoutEntriesNet: 0,
    legacyPaidOutNet: 0,
    paidDebts: 50000,
    outstandingDebts: 0,
    cashAgreed: 150000,
    cashReceived: 100000,
    cashOutstanding: 50000
  };

  const scanned = { payments: 3, paymentAttempts: 4, earnings: 3, payouts: 0, payoutEntries: 0, debts: 1, cashSettlements: 1 };

  const clean: LedgerReconciliation = {
    checkedAt: '2026-11-10T17:00:05Z',
    consistent: true,
    balanced: true,
    totals,
    scanned,
    balances: [
      { code: 'SERVICE_COLLECTED_EQUALS_SERVICE_EARNINGS', description: 'Lo cobrado por servicios es igual al bruto de los ingresos de servicio', expected: 400000, actual: 400000, holds: true },
      { code: 'DEBT_COLLECTED_EQUALS_DEBT_EARNINGS', description: 'Lo cobrado por saldos pendientes es igual al bruto de los ingresos de saldo', expected: 50000, actual: 50000, holds: true }
    ],
    findings: []
  };

  const broken: LedgerReconciliation = {
    ...clean,
    checkedAt: '2026-11-10T17:05:00Z',
    consistent: false,
    balanced: false,
    balances: [
      { ...clean.balances[0], expected: 400000, actual: 399999, holds: false },
      clean.balances[1]
    ],
    findings: [
      {
        code: 'EARNING_COMMISSION_MISMATCH',
        description: 'La comisión guardada no corresponde a la tarifa copiada en el ingreso',
        count: 1,
        sample: ['7d1c0d4e-0000-4000-8000-000000000001']
      },
      {
        code: 'PAID_DEBT_WITHOUT_PAYMENT',
        description: 'Deuda marcada como pagada sin un pago aprobado por el mismo monto',
        count: 12,
        sample: ['7d1c0d4e-0000-4000-8000-000000000002', '7d1c0d4e-0000-4000-8000-000000000003']
      }
    ]
  };

  const empty: LedgerReconciliation = {
    ...clean,
    totals: Object.fromEntries(Object.keys(totals).map((key) => [key, 0])) as unknown as LedgerTotals,
    scanned: { payments: 0, paymentAttempts: 0, earnings: 0, payouts: 0, payoutEntries: 0, debts: 0, cashSettlements: 0 },
    balances: clean.balances.map((b) => ({ ...b, expected: 0, actual: 0 }))
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => (host().textContent ?? '').replace(/\s+/g, ' ');
  const button = () => host().querySelector<HTMLButtonElement>('.actions button')!;
  const alertText = () => (host().querySelector('app-error')?.textContent ?? '').replace(/\s+/g, ' ');

  function settle(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  function answer(value: LedgerReconciliation | Error): void {
    const current = responses;
    // HttpErrorResponse no hereda de Error, así que se distingue por la forma de la respuesta.
    if (!('totals' in value)) current.error(value);
    else {
      current.next(value);
      current.complete();
    }
    settle();
  }

  const httpError = (status: number, code?: string) =>
    new HttpErrorResponse({ status, error: code ? JSON.stringify({ code, message: 'technical detail' }) : null });

  beforeEach(async () => {
    calls = 0;
    await TestBed.configureTestingModule({
      imports: [LedgerReconciliationPage],
      providers: [
        {
          provide: WorkApi,
          useValue: {
            ledgerReconciliation: () => {
              calls++;
              responses = new Subject<LedgerReconciliation>();
              return responses;
            }
          }
        }
      ]
    }).compileComponents();
  });

  function open(): void {
    fixture = TestBed.createComponent(LedgerReconciliationPage);
    settle();
  }

  describe('resultado de una corrida completa', () => {
    beforeEach(open);

    it('dice que el libro cuadra, sobre cuántas filas y cuándo, con todas las ecuaciones', () => {
      answer(clean);

      expect(text()).toContain('El libro cuadra');
      expect(text()).toContain('Se revisaron 12 filas');
      // 17:00:05 UTC son las 12:00:05 en Colombia, con segundos y sin depender del navegador.
      expect(text()).toMatch(/10 de noviembre de 2026.*12:00:05/);
      expect(host().querySelector('time')?.getAttribute('datetime')).toBe('2026-11-10T17:00:05Z');
      expect(text()).toContain('Lo cobrado por saldos pendientes es igual al bruto de los ingresos de saldo');
      expect(host().querySelectorAll('tr.off').length).toBe(0);
      expect(text()).toContain('En esta corrida ninguna de las nueve reglas');
      expect(text()).toContain('solo aparecen las reglas que tienen filas que las rompen');
    });

    it('muestra varias reglas rotas con sus conteos e identificadores, y la ecuación que no cuadra', () => {
      answer(broken);

      expect(text()).toContain('Hay diferencias en el libro');
      expect(text()).not.toContain('El libro cuadra');
      expect(text()).toContain('2 reglas con diferencias y 1 ecuación que no cuadra');
      expect(text()).toContain('EARNING_COMMISSION_MISMATCH');
      expect(text()).toContain('PAID_DEBT_WITHOUT_PAYMENT');
      expect(text()).toContain('7d1c0d4e-0000-4000-8000-000000000001');
      expect(text()).toContain('7d1c0d4e-0000-4000-8000-000000000003');
      const off = host().querySelectorAll('tr.off');
      expect(off.length).toBe(1);
      expect(off[0].textContent).toContain('No cuadra');
      expect(off[0].textContent).toMatch(/400\.000/);
      expect(off[0].textContent).toMatch(/399\.999/);
    });

    it('con el libro vacío no dice que cuadra: dice que no hay nada que conciliar', () => {
      answer(empty);

      expect(text()).toContain('El libro está vacío');
      expect(text()).not.toContain('El libro cuadra');
      expect(text()).toContain('No había filas que revisar');
      expect(text()).toContain('esto no es un resultado válido');
    });

    it('muestra completos los montos que no caben en un number', () => {
      const huge = 9007199254740993n;
      answer({
        ...clean,
        totals: { ...totals, collected: huge },
        balances: [{ ...clean.balances[0], expected: huge, actual: huge }]
      });

      expect(text()).toContain('9.007.199.254.740.993');
      expect(text()).not.toContain('9.007.199.254.740.992');
    });
  });

  describe('una consulta que no trae resultado nunca se muestra como "El libro cuadra"', () => {
    beforeEach(open);

    const cases: [string, () => Error, string, boolean][] = [
      ['503 LEDGER_UNREADABLE', () => httpError(503, 'LEDGER_UNREADABLE'), 'No se pudo leer el libro de pagos', true],
      ['503 LEDGER_RECONCILIATION_BUSY', () => httpError(503, 'LEDGER_RECONCILIATION_BUSY'), 'Ya hay una conciliación en curso', true],
      ['503 LEDGER_RECONCILIATION_DISABLED', () => httpError(503, 'LEDGER_RECONCILIATION_DISABLED'), 'La conciliación está deshabilitada', false],
      ['404 (ruta apagada en el servidor)', () => httpError(404), 'La conciliación está deshabilitada', false],
      ['503 sin código', () => httpError(503), 'No se pudo conciliar el libro', true],
      ['500', () => httpError(500), 'No se pudo conciliar el libro', true],
      ['sin red', () => httpError(0), 'No hay conexión con el servidor', true],
      ['tiempo agotado', () => new TimeoutError(), 'La conciliación tardó demasiado', true],
      ['respuesta fuera de contrato', () => new LedgerContractError('scanned no es un objeto'), 'no se pudo interpretar', true],
      ['403', () => httpError(403, 'FORBIDDEN'), 'Tu cuenta no puede ver la conciliación', false],
      ['401', () => httpError(401), 'Tu sesión terminó', false]
    ];

    it.each(cases)('%s', (_name, error, title, retryable) => {
      answer(error());

      expect(alertText()).toContain(title);
      expect(text()).not.toContain('El libro cuadra');
      expect(host().querySelector('table')).toBeNull();
      expect(host().querySelector('app-error button') !== null).toBe(retryable);
    });

    it('si falla después de una corrida buena, el resultado anterior deja de verse', () => {
      answer(clean);
      expect(text()).toContain('El libro cuadra');

      button().click();
      settle();
      expect(text()).not.toContain('El libro cuadra');
      expect(text()).toContain('Conciliando el libro de pagos');

      answer(httpError(503, 'LEDGER_UNREADABLE'));
      expect(text()).not.toContain('El libro cuadra');
      expect(alertText()).toContain('Esto no quiere decir que el libro cuadre');
    });

    it('con la conciliación deshabilitada no muestra saldos, ecuaciones ni filas revisadas', () => {
      answer(httpError(503, 'LEDGER_RECONCILIATION_DISABLED'));

      expect(alertText()).toContain('Esto no quiere decir que el libro cuadre');
      expect(text()).not.toContain('El libro cuadra');
      expect(text()).not.toContain('Filas revisadas');
      expect(text()).not.toContain('Ecuaciones del libro');
    });

    it('"Reintentar" pide otra corrida y muestra su resultado', () => {
      answer(httpError(503, 'LEDGER_RECONCILIATION_BUSY'));
      const before = calls;

      host().querySelector<HTMLButtonElement>('app-error button')!.click();
      settle();
      expect(calls).toBe(before + 1);

      answer(clean);
      expect(text()).toContain('El libro cuadra');
      expect(host().querySelector('app-error')).toBeNull();
    });
  });

  describe('"Conciliar ahora"', () => {
    beforeEach(open);

    it('pide una conciliación nueva', () => {
      answer(clean);
      const before = calls;

      button().click();
      settle();

      expect(calls).toBe(before + 1);
    });

    it('no lanza corridas simultáneas: mientras hay una en curso, pulsar de nuevo no pide otra', () => {
      expect(calls).toBe(1);
      expect(button().getAttribute('aria-disabled')).toBe('true');

      button().click();
      button().click();
      settle();
      expect(calls).toBe(1);

      answer(clean);
      expect(button().getAttribute('aria-disabled')).toBe('false');
      button().click();
      button().click();
      settle();
      expect(calls).toBe(2);
    });

    it('el botón conserva el foco del teclado mientras concilia', () => {
      answer(clean);
      button().focus();
      button().click();
      settle();

      expect(button().disabled).toBe(false);
      expect(document.activeElement).toBe(button());
    });
  });

  describe('cambio de sesión', () => {
    const admin = { id: 'admin-1', email: null, displayName: 'Soporte', status: 'ACTIVE' as const, roles: ['PLATFORM_ADMIN' as const] };

    it('si cambia la persona o el rol, lo anterior se borra y se le pregunta de nuevo al servidor', () => {
      const users = TestBed.inject(CurrentUserStore);
      users.setProfile(admin);
      open();
      answer(clean);
      expect(text()).toContain('El libro cuadra');

      users.setProfile({ ...admin, id: 'owner-9', roles: ['OWNER'] });
      settle();

      expect(text()).not.toContain('El libro cuadra');
      expect(host().querySelector('table')).toBeNull();
      expect(calls).toBe(2);

      answer(httpError(403, 'FORBIDDEN'));
      expect(alertText()).toContain('Tu cuenta no puede ver la conciliación');
    });

    it('una respuesta pedida por la sesión anterior no se muestra a la nueva', () => {
      const users = TestBed.inject(CurrentUserStore);
      users.setProfile(admin);
      open();
      const first = responses;

      users.setProfile({ ...admin, id: 'owner-9', roles: ['OWNER'] });
      settle();
      first.next(clean);
      first.complete();
      settle();

      expect(text()).not.toContain('El libro cuadra');
      expect(text()).toContain('Conciliando el libro de pagos');
    });
  });

  it('al salir de la pantalla se abandona la corrida en curso', () => {
    open();
    const current = responses;
    expect(current.observed).toBe(true);

    fixture.destroy();

    expect(current.observed).toBe(false);
  });
});
