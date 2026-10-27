import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from '../core/auth/current-user.store';
import { KnownPaymentsService } from './known-payments';

describe('KnownPaymentsService', () => {
  let service: KnownPaymentsService;
  let userStore: CurrentUserStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(KnownPaymentsService);
    userStore = TestBed.inject(CurrentUserStore);
    userStore.setProfile({
      id: 'user-abc',
      email: 'user@fixup.com',
      displayName: 'Test User',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('registra y lista pagos conocidos para el usuario activo', () => {
    expect(service.list()).toEqual([]);

    service.register({
      paymentId: 'pay-123',
      requestId: 'req-456',
      amount: 150000,
      reference: 'FIX-REQ-456-01',
      status: 'PENDING'
    });

    const list = service.list();
    expect(list.length).toBe(1);
    expect(list[0].paymentId).toBe('pay-123');
    expect(list[0].status).toBe('PENDING');
  });

  it('actualiza el estado de un pago conocido', () => {
    service.register({
      paymentId: 'pay-123',
      status: 'PENDING'
    });

    service.updateStatus('pay-123', 'APPROVED');
    expect(service.get('pay-123')?.status).toBe('APPROVED');
  });

  it('separa los pagos por usuario activo', () => {
    service.register({ paymentId: 'pay-user-1' });

    userStore.setProfile({
      id: 'user-xyz',
      email: 'other@fixup.com',
      displayName: 'Other User',
      status: 'ACTIVE',
      roles: ['OWNER']
    });

    expect(service.list()).toEqual([]);
    service.register({ paymentId: 'pay-user-2' });
    expect(service.list().length).toBe(1);
    expect(service.list()[0].paymentId).toBe('pay-user-2');
  });

  it('encuentra pagos por requestId y enriquece con remember', () => {
    service.remember('pay-enrich-1', {
      requestId: 'req-999',
      propertyTitle: 'Apartamento 302',
      amount: 250000n,
      reference: 'FIX-999',
      status: 'PENDING'
    });

    const found = service.findForRequest('req-999');
    expect(found).toBeDefined();
    expect(found?.paymentId).toBe('pay-enrich-1');
    expect(found?.propertyTitle).toBe('Apartamento 302');
    expect(found?.amount).toBe('250000');
  });

  it('clearSessionFinancialData limpia claves temporales de sessionStorage preservando otras entradas', () => {
    sessionStorage.setItem('fixup_pending_attempt_user-abc_pay-1', '{"key":"uuid-1"}');
    sessionStorage.setItem('fixup_in_flight_payout_user-abc', 'uuid-payout');
    sessionStorage.setItem('unrelated_app_key', 'preserve-me');

    service.clearSessionFinancialData();

    expect(sessionStorage.getItem('fixup_pending_attempt_user-abc_pay-1')).toBeNull();
    expect(sessionStorage.getItem('fixup_in_flight_payout_user-abc')).toBeNull();
    expect(sessionStorage.getItem('unrelated_app_key')).toBe('preserve-me');

    sessionStorage.clear();
  });
});

