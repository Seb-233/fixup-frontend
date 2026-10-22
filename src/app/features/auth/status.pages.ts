import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <div class="state">
        <h1 class="title-display">Esta sección no es de tu rol</h1>
        <p>Tu rol activo no tiene acceso a esta página. Si tu cuenta tiene otro rol, cámbialo desde el menú.</p>
        <a routerLink="/dashboard" class="btn btn-primary">Volver al inicio</a>
      </div>
    </div>
  `
})
export class AccessDeniedPage {}

@Component({
  selector: 'app-account-restricted-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <div class="state">
        <h1 class="title-display">Tu cuenta está restringida</h1>
        <p>
          La cuenta fue suspendida o desactivada y no puede operar en Fix&amp;Rent. Escribe a soporte para revisar el caso.
        </p>
        <button type="button" class="btn btn-secondary" (click)="logout()">Cerrar sesión</button>
      </div>
    </div>
  `
})
export class AccountRestrictedPage {
  private readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout().subscribe();
  }
}
