import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, filter, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';

export const verifiedFixerGuard: CanActivateFn = async () => {
  const store = inject(FixerVerificationStore);
  const router = inject(Router);
  store.ensureLoaded();
  if (store.loading()) await firstValueFrom(toObservable(store.loading).pipe(filter((loading) => !loading), take(1)));
  return store.verified() ? true : router.createUrlTree(['/fixers/verification']);
};