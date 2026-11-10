import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { LedgerReconciliation } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { LedgerReconciliationPage } from './ledger-reconciliation.page';

describe('LedgerReconciliationPage (SAF-01)', () => {
  let fixture: ComponentFixture<LedgerReconciliationPage>;
  let responses: Subject<LedgerReconciliation>;
  let calls: number;

  const totals = {
    collected: 450000,
    earningsGross: 450000,
    commission: 45000,
    net: 405000,
    heldNet: 405000,
    availableNet: 0,
    paidOutNet: 0,
    payouts: 0,
    outstandingDebts: 0
  };

  const clean: LedgerReconciliation = {
    checkedAt: '2026-11-10T17:00:00Z',
    consistent: true,
    balanced: true,
    totals,
    findings: []
  };

  const broken: LedgerReconciliation = {
    checkedAt: '2026-11-10T17:05:00Z',
    consistent: false,
    balanced: true,
    totals: { ...totals, commission: 44999, net: 405001, heldNet: 405001 },
    findings: [
      {
        code: 'EARNING_COMMISSION_MISMATCH',
        description: 'La comisión guardada no corresponde a la tarifa copiada en el ingreso',
        count: 1,
        sample: ['7d1c0d4e-0000-4000-8000-000000000001']
      }
    ]
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function settle(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  async function answer(value: LedgerReconciliation | HttpErrorResponse): Promise<void> {
    if (value instanceof HttpErrorResponse) responses.error(value);
    else {
      responses.next(value);
      responses.complete();
    }
    await fixture.whenStable();
    settle();
  }

  beforeEach(async () => {
    calls = 0;
    responses = new Subject<LedgerReconciliation>();
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
    fixture = TestBed.createComponent(LedgerReconciliationPage);
    settle();
  });

  it('muestra que el libro cuadra y la ecuación del balance', async () => {
    await answer(clean);

    expect(text()).toContain('El libro cuadra');
    expect(text()).toContain('Cobrado');
    expect(text()).toContain('=');
    expect(text()).toContain('Ninguna de las nueve reglas');
  });

  it('marca la regla rota con el identificador exacto de la fila', async () => {
    await answer(broken);

    expect(text()).toContain('Hay diferencias en el libro');
    expect(text()).toContain('EARNING_COMMISSION_MISMATCH');
    expect(text()).toContain('7d1c0d4e-0000-4000-8000-000000000001');
  });

  it('pide una conciliación nueva al pulsar "Conciliar ahora"', async () => {
    await answer(clean);
    const before = calls;

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.actions button')!.click();
    settle();

    expect(calls).toBe(before + 1);
  });

  it('ofrece reintentar si el backend falla', async () => {
    await answer(new HttpErrorResponse({ status: 503 }));

    expect(text()).not.toContain('El libro cuadra');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-error')).not.toBeNull();
  });
});
