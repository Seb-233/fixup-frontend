import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LoadingComponent } from '../../shared/ui/states.component';

// Retorno de Auth0: espera el perfil del backend y lleva a la persona a donde iba.
@Component({
  selector: 'app-callback-page',
  imports: [LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page page-narrow"><app-loading text="Abriendo tu sesión…" /></div>`
})
export class CallbackPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const error = params.get('error_description') || params.get('error');
    if (error) {
      this.router.navigate(['/auth/login'], { queryParams: { error }, replaceUrl: true });
      return;
    }

    this.auth.error$.pipe(take(1)).subscribe((failure) => {
      if (failure?.message) {
        this.router.navigate(['/auth/login'], { queryParams: { error: failure.message }, replaceUrl: true });
      }
    });

    this.auth.sessionReady$.pipe(filter((profile) => profile !== null), take(1)).subscribe((profile) => {
      if (!profile) return;
      if (profile.status === 'SUSPENDED' || profile.status === 'DISABLED') {
        this.router.navigate(['/auth/account-restricted'], { replaceUrl: true });
        return;
      }
      if (profile.roles.length === 0) {
        this.router.navigate(['/auth/select-role'], { replaceUrl: true });
        return;
      }
      this.auth.appState$.pipe(take(1)).subscribe((state) => {
        const raw = state?.target || params.get('returnUrl');
        const target = raw && raw.startsWith('/') && !raw.startsWith('//') && raw !== '/auth/select-role' ? raw : '/dashboard';
        this.router.navigateByUrl(target, { replaceUrl: true });
      });
    });
  }
}
