import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { BackendUserProfile } from '../../core/auth/auth.types';
import { PaymentDetail, PaymentPageResponse, PaymentStatus } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { PaymentsPage } from './payments.page';

interface MockWorkApi {
  myDebts: () => Observable<never[]>;
  myPayments: (params?: { page?: number; size?: number; status?: PaymentStatus }) => Observable<PaymentPageResponse>;
  payment: (id: string) => Observable<PaymentDetail>;
}

describe('PaymentsPage', () => {
  let component: PaymentsPage;
  let fixture: ComponentFixture<PaymentsPage>;
  let workApi: MockWorkApi;
  let userStore: CurrentUserStore;

  const mockPayments: PaymentDetail[] = [
    {
      paymentId: 'pay-001',
      quotationId: 'q-001',
      requestId: 'req-001',
      amount: 250000,
      paymentMethod: 'TRANSFER',
      purpose: 'SERVICE',
      status: 'APPROVED',
      createdAt: '2026-10-24T10:00:00Z',
      updatedAt: '2026-10-24T10:00:00Z',
      reference: 'FXR-PAY001'
    },
    {
      paymentId: 'pay-002',
      quotationId: 'q-002',
      requestId: 'req-002',
      amount: 180000,
      paymentMethod: 'TRANSFER',
      purpose: 'SERVICE',
      status: 'PENDING',
      createdAt: '2026-10-25T11:00:00Z',
      updatedAt: '2026-10-25T11:00:00Z',
      reference: 'FXR-PAY002'
    }
  ];

  beforeEach(async () => {
    workApi = {
      myDebts: () => of([]),
      myPayments: (params?: { page?: number; size?: number; status?: PaymentStatus }) =>
        of<PaymentPageResponse>({
          items: mockPayments,
          page: params?.page ?? 0,
          size: params?.size ?? 10,
          hasMore: false
        }),
      payment: (id: string) => of(mockPayments.find((p) => p.paymentId === id) || mockPayments[0])
    };

    await TestBed.configureTestingModule({
      imports: [PaymentsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: WorkApi, useValue: workApi }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    const mockProfile: BackendUserProfile = {
      id: 'user-owner-1',
      email: 'owner@fixup.test',
      displayName: 'Carolina Restrepo',
      status: 'ACTIVE',
      roles: ['OWNER']
    };
    userStore.setProfile(mockProfile);

    fixture = TestBed.createComponent(PaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('recupera y lista los pagos desde GET /payments/me autoritativo', () => {
    expect(component.items().length).toBe(2);
    expect(component.items()[0].paymentId).toBe('pay-001');
    expect(component.approvedCount()).toBe(1);
    expect(component.pendingCount()).toBe(1);
  });

  it('filtra por estado reseteando a la primera página', () => {
    component.page.set(2);
    component.setStatusFilter('PENDING');
    expect(component.statusFilter()).toBe('PENDING');
    expect(component.page()).toBe(0);
  });

  it('controla la paginación con prevPage y nextPage', () => {
    expect(component.page()).toBe(0);
    component.prevPage();
    expect(component.page()).toBe(0); // No baja de 0
  });

  it('selecciona un pago y carga su detalle para el panel', () => {
    component.selectPayment('pay-001');
    expect(component.selectedPaymentId()).toBe('pay-001');
    expect(component.selectedDetail()?.paymentId).toBe('pay-001');
  });
});
