import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { SessionLoadingComponent } from '../session-loading/session-loading.component';

// Maneja el callback de Auth0, valida errores, sincroniza con backend y redirige a la ruta solicitada
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, SessionLoadingComponent],
  template: `
    <app-session-loading></app-session-loading>
  `
})
export class CallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly userStore = inject(CurrentUserStore);

  ngOnInit(): void {
    // 1. Capturar posibles errores devueltos directamente por Auth0 en queryParams
    const queryParams = this.route.snapshot.queryParamMap;
    const error = queryParams.get('error');
    const errorDescription = queryParams.get('error_description');

    if (error) {
      const message = errorDescription || error || 'Error en el proceso de autenticación con Auth0';
      this.router.navigate(['/auth/login'], {
        queryParams: { error: message },
        replaceUrl: true
      });
      return;
    }

    // 2. Monitorear errores emitidos por el SDK de Auth0 durante el intercambio
    this.auth.error$.pipe(take(1)).subscribe((err) => {
      if (err) {
        this.router.navigate(['/auth/login'], {
          queryParams: { error: err.message || 'Error autenticando con Auth0' },
          replaceUrl: true
        });
      }
    });

    // 3. Esperar que sessionReady$ resuelva el perfil interno del backend
    this.auth.sessionReady$
      .pipe(
        filter((profile) => profile !== null),
        take(1)
      )
      .subscribe((profile) => {
        if (!profile) return;

        // Cuenta inactiva o suspendida
        if (profile.status === 'SUSPENDED' || profile.status === 'DISABLED') {
          this.router.navigate(['/auth/account-restricted'], { replaceUrl: true });
          return;
        }

        // Si no existen roles (cuenta nueva), redirigir a select-role para onboarding inicial
        if (profile.roles.length === 0) {
          this.router.navigate(['/auth/select-role'], { replaceUrl: true });
          return;
        }

        // Si ya cuenta con roles asignados, continuar al target seguro (dashboard)
        this.auth.appState$.pipe(take(1)).subscribe((appState) => {
          const rawTarget = appState?.target || this.route.snapshot.queryParamMap.get('returnUrl');
          const safeTarget =
            rawTarget &&
            rawTarget.startsWith('/') &&
            !rawTarget.startsWith('//') &&
            rawTarget !== '/auth/select-role'
              ? rawTarget
              : '/dashboard';

          this.router.navigateByUrl(safeTarget, { replaceUrl: true });
        });
      });
  }
}
