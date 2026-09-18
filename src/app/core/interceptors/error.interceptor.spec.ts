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

  it('debe limpiar CurrentUserStore y redirigir al login ante un error 401 Unauthorized', async () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'test@fixup.com',
      displayName: 'Test',
      status: 'ACTIVE',
      roles: ['OWNER']
    });

    const error401 = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
    const req = new HttpRequest('GET', '/test');
    const nextFn = () => throwError(() => error401);

    await expect(
      firstValueFrom(TestBed.runInInjectionContext(() => errorInterceptor(req, nextFn)))
    ).rejects.toMatchObject({ status: 401 });

    expect(userStore.user()).toBeNull();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('debe redirigir a /auth/access-denied ante un error 403 sin cerrar la sesión del usuario', async () => {
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
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/access-denied']);
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
