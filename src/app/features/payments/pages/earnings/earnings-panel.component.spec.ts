import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  EarningStatus,
  EarningsResponse,
  PaymentControllerService,
  PayoutResponse,
  PayoutStatus,
  provideApi
} from '../../../../api/generated';
import { EarningsPanelComponent } from './earnings-panel.component';

describe('EarningsPanelComponent (Panel de ingresos y transferencias del Fixer)', () => {
  let component: EarningsPanelComponent;
  let httpTesting: HttpTestingController;

  const mockEarnings: EarningsResponse = {
    availableBalance: 270000,
    heldBalance: 135000,
    totalCommission: 45000,
    grossTotal: 450000,
    paidOutTotal: 0,
    history: [
      {
        id: 'earn-1',
        quotationId: 'quot-1',
        grossAmount: 300000,
        commissionAmount: 30000,
        netAmount: 270000,
        commissionRateBasisPoints: 1000,
        status: EarningStatus.Available,
        createdAt: '2026-10-14T10:00:00Z',
        releasedAt: '2026-10-15T09:00:00Z'
      },
      {
        id: 'earn-2',
        quotationId: 'quot-2',
        grossAmount: 150000,
        commissionAmount: 15000,
        netAmount: 135000,
        commissionRateBasisPoints: 1000,
        status: EarningStatus.Held,
        createdAt: '2026-10-15T11:00:00Z'
      }
    ]
  };

  const mockPayouts: PayoutResponse[] = [
    {
      id: 'payout-1',
      amount: 200000,
      earningCount: 1,
      status: PayoutStatus.Transferred,
      requestedAt: '2026-10-10T12:00:00Z',
      transferredAt: '2026-10-11T15:00:00Z'
    },
    {
      id: 'payout-2',
      amount: 150000,
      earningCount: 1,
      status: PayoutStatus.Requested,
      requestedAt: '2026-10-12T12:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EarningsPanelComponent],
      providers: [
        PaymentControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(EarningsPanelComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('debe cargar y desplegar el resumen autoritativo de saldos del backend (HELD, AVAILABLE, comisión)', () => {
    component.ngOnInit();

    const earnReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`);
    expect(earnReq.request.method).toBe('GET');
    earnReq.flush(mockEarnings);

    const payoutsReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`);
    expect(payoutsReq.request.method).toBe('GET');
    payoutsReq.flush(mockPayouts);

    expect(component.loading()).toBe(false);
    expect(component.summary()?.availableBalance).toBe(270000);
    expect(component.summary()?.heldBalance).toBe(135000);
    expect(component.summary()?.totalCommission).toBe(45000);
    expect(component.summary()?.grossTotal).toBe(450000);

    // Los montos brutos, comisiones y netos son autoritativos del backend
    expect(component.summary()?.history.length).toBe(2);
    expect(component.statusLabel(EarningStatus.Available)).toBe('Disponible');
    expect(component.statusLabel(EarningStatus.Held)).toBe('Retenido');
    expect(component.statusLabel(EarningStatus.PaidOut)).toBe('Transferencia solicitada');
  });

  it('debe mostrar transferencias históricas REQUESTED y nuevas TRANSFERRED', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`).flush(mockEarnings);
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`).flush(mockPayouts);

    expect(component.payouts().length).toBe(2);
    expect(component.payoutLabel(PayoutStatus.Transferred)).toBe('Transferido');
    expect(component.payoutLabel(PayoutStatus.Requested)).toBe('Solicitada');
  });

  it('debe permitir solicitar transferencia de saldo disponible y refrescar datos', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`).flush(mockEarnings);
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`).flush([]);

    component.requestPayout();
    expect(component.requesting()).toBe(true);

    const postPayout = httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`);
    expect(postPayout.request.method).toBe('POST');
    // Sin cuerpo: el monto lo calcula el backend
    expect(postPayout.request.body).toBeNull();
    const createdPayout: PayoutResponse = {
      id: 'payout-new',
      amount: 270000,
      earningCount: 1,
      status: PayoutStatus.Transferred,
      requestedAt: '2026-10-15T12:00:00Z',
      transferredAt: '2026-10-15T12:00:00Z'
    };
    postPayout.flush(createdPayout);

    expect(component.requesting()).toBe(false);
    expect(component.lastPayout()?.amount).toBe(270000);

    // Refetch de earnings y payouts
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`).flush({
      ...mockEarnings,
      availableBalance: 0,
      paidOutTotal: 270000
    });
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`).flush([createdPayout]);
    expect(component.summary()?.availableBalance).toBe(0);
    expect(component.paidOutTileLabel()).toBe('Total transferido');
    expect(component.displayPayout()?.status).toBe(PayoutStatus.Transferred);
  });

  it('debe ajustar la tarjeta resumen a "Solicitado para transferencia" cuando hay un payout REQUESTED pendiente', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`).flush(mockEarnings);
    // mockPayouts contiene payout-2 con status REQUESTED
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`).flush(mockPayouts);

    expect(component.hasPendingPayout()).toBe(true);
    expect(component.paidOutTileLabel()).toBe('Solicitado para transferencia');
  });

  it('debe mostrar "Total transferido" cuando todos los payouts están en TRANSFERRED', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/earnings`).flush({
      ...mockEarnings,
      availableBalance: 0,
      paidOutTotal: 200000
    });
    httpTesting.expectOne(`${environment.apiOrigin}/payments/me/payouts`).flush([mockPayouts[0]]); // payout-1 TRANSFERRED

    expect(component.hasPendingPayout()).toBe(false);
    expect(component.paidOutTileLabel()).toBe('Total transferido');
  });
});
