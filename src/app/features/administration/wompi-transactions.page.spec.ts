import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { WompiTransactionList, WompiTransactionView } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { WompiTransactionsPage } from './wompi-transactions.page';

describe('WompiTransactionsPage (INT-01)', () => {
  let fixture: ComponentFixture<WompiTransactionsPage>;
  let page: WompiTransactionsPage;
  let wompiTransactions: ReturnType<typeof vi.fn>;
  let next: () => Observable<WompiTransactionList>;

  const tx = (over: Partial<WompiTransactionView>): WompiTransactionView => ({
    transactionId: '12077206-1-1',
    reference: 'FXR-ABC-0CCA96DC',
    amountInCents: 10_000_000,
    currency: 'COP',
    status: 'APPROVED',
    paymentMethodType: 'NEQUI',
    createdAt: '2026-11-14T15:35:34Z',
    paymentId: 'pay-1',
    paymentReference: 'FXR-ABC',
    paymentPurpose: 'SERVICE',
    paymentStatus: 'APPROVED',
    recordedStatus: 'APPROVED',
    reconciliation: 'RECORDED',
    ...over
  });

  const list = (items: WompiTransactionView[], totalResults = items.length): WompiTransactionList => ({
    environment: 'sandbox',
    from: '2026-10-15',
    until: '2026-11-14',
    status: 'APPROVED',
    page: 1,
    pageSize: 20,
    totalResults,
    items
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(WompiTransactionsPage);
    page = fixture.componentInstance;
    TestBed.tick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    next = () => of(list([]));
    wompiTransactions = vi.fn(() => next());
    await TestBed.configureTestingModule({
      imports: [WompiTransactionsPage],
      providers: [{ provide: WorkApi, useValue: { wompiTransactions } }]
    }).compileComponents();
  });

  it('pide las aprobadas por omisión y llena el rango con el que eligió el backend', async () => {
    await render();
    expect(wompiTransactions).toHaveBeenCalledWith({ from: undefined, until: undefined, status: 'APPROVED', page: 1, size: 20 });
    expect(page.from).toBe('2026-10-15');
    expect(page.until).toBe('2026-11-14');
    expect(text()).toContain('Sin transacciones');
    expect(text()).toContain('ambiente de pruebas');
  });

  it('muestra cada transacción con su pago en FixUp y resalta lo que hay que revisar', async () => {
    next = () =>
      of(
        list([
          tx({}),
          tx({ transactionId: '12077206-2-2', reconciliation: 'DUPLICATE', recordedStatus: null }),
          tx({ transactionId: '999-OTRA', reference: 'OTRA-TIENDA-1', paymentId: null, paymentReference: null, paymentStatus: null, reconciliation: 'FOREIGN', amountInCents: 5_000_000 })
        ])
      );
    await render();
    const content = text();
    expect(content).toContain('12077206-1-1');
    expect(content).toContain('Nequi');
    expect(content).toContain('Registrada');
    expect(content).toContain('Cobro doble');
    expect(content).toContain('Reembolsa esta desde el panel de Wompi');
    expect(content).toContain('Ajena a FixUp');
    expect(content).toContain('OTRA-TIENDA-1');
    expect(page.approved().count).toBe(3);
    expect(page.attention()).toBe(1);
    expect(content).toMatch(/100\.000/);
  });

  it('una aprobada sin registrar cuenta para revisar; una rechazada sin registrar no', async () => {
    next = () =>
      of(
        list([
          tx({ reconciliation: 'NOT_RECORDED', recordedStatus: null, paymentStatus: 'PENDING' }),
          tx({ transactionId: 'x-2', status: 'DECLINED', reconciliation: 'NOT_RECORDED', recordedStatus: null })
        ])
      );
    await render();
    expect(page.attention()).toBe(1);
    expect(text()).toContain('Sin registrar');
  });

  it('consulta con el filtro elegido y pagina sin perderlo', async () => {
    next = () => of(list([tx({})], 45));
    await render();
    page.from = '2026-11-01';
    page.until = '2026-11-14';
    page.status = 'ALL';
    page.search();
    await fixture.whenStable();
    expect(wompiTransactions).toHaveBeenLastCalledWith({ from: '2026-11-01', until: '2026-11-14', status: 'ALL', page: 1, size: 20 });
    fixture.detectChanges();
    expect(page.pages()).toBe(3);
    expect(text()).toContain('Página 1 de 3');
    page.go(2);
    await fixture.whenStable();
    expect(wompiTransactions).toHaveBeenLastCalledWith({ from: '2026-11-01', until: '2026-11-14', status: 'ALL', page: 2, size: 20 });
  });

  it('explica en español por qué Wompi no respondió', async () => {
    next = () => throwError(() => new HttpErrorResponse({ status: 503, error: { code: 'WOMPI_NOT_CONFIGURED' } }));
    await render();
    expect(text()).toContain('Reintentar');
    expect(page.failure()).not.toContain('WOMPI_NOT_CONFIGURED');
    expect(page.failure().length).toBeGreaterThan(10);
  });
});
