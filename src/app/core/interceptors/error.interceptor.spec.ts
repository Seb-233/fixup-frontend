import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CurrentUserStore } from '../auth/current-user.store';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let userStore: CurrentUserStore;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routerNavigateSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        CurrentUserStore,
        { provide: Router, useValue: { navigate: routerNavigateSpy } }
      ]
    });

    userStore = TestBed.inject(CurrentUserStore);
  });

  it('debe limpiar CurrentUserStore, datos financieros de sesión y redirigir al login ante un error 401 Unauthorized', async () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'test@fixup.com',
      displayName: 'Test',
      status: 'ACTIVE',
      roles: ['OWNER']
    });

    sessionStorage.setItem('fixup_pending_attempt_pay-1', 'test-data');
    sessionStorage.setItem('fixup_in_flight_payout_fixer-1', 'payout-data');

    const error401 = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    const req = new HttpRequest('GET', '/test');
    const nextFn = () => throwError(() => error401);

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => errorInterceptor(req, nextFn)))
    ).rejects.toMatchObject({ status: 401 });

    expect(userStore.user()).toBeNull();
    expect(sessionStorage.getItem('fixup_pending_attempt_pay-1')).toBeNull();
    expect(sessionStorage.getItem('fixup_in_flight_payout_fixer-1')).toBeNull();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('un 403 de una acción no cambia de pantalla ni cierra la sesión', async () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'active@fixup.com',
      displayName: 'Active User',
      status: 'ACTIVE',
      roles: ['TENANT']
    });

    const error403 = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      error: { code: 'ACCESS_DENIED' }
    });
    const req = new HttpRequest('GET', '/test');
    const nextFn = () => throwError(() => error403);

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => errorInterceptor(req, nextFn)))
    ).rejects.toMatchObject({ status: 403 });

    expect(userStore.user()).not.toBeNull();
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('un 409 no modifica el estado global de la sesión', async () => {
    const error409 = new HttpErrorResponse({ status: 409, error: { code: 'FIXER_BUSY' } });
    const nextFn = () => throwError(() => error409);

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => errorInterceptor(new HttpRequest('POST', '/visits', {}), nextFn)))
    ).rejects.toMatchObject({ status: 409 });

    expect(userStore.error()).toBeNull();
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('debe redirigir a /auth/account-restricted ante 403 si la cuenta está SUSPENDED o DISABLED', async () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'suspended@fixup.com',
      displayName: 'Suspended User',
      status: 'SUSPENDED',
      roles: ['TENANT']
    });

    const error403 = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      error: { code: 'ACCESS_DENIED' }
    });
    const req = new HttpRequest('GET', '/test');
    const nextFn = () => throwError(() => error403);

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => errorInterceptor(req, nextFn)))
    ).rejects.toMatchObject({ status: 403 });

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/account-restricted']);
  });
});
