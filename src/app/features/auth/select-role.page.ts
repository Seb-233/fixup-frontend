import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { INITIAL_ROLE_DETAILS, SelectableRole } from '../../core/auth/auth.types';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { errorMessage } from '../../shared/format';

const ROLE_COPY: Record<SelectableRole, { title: string; text: string }> = {
  OWNER: {
    title: 'Tengo inmuebles',
    text: 'Publico apartamentos o casas, recibo reportes de daños y contrato técnicos.'
  },
  TENANT: {
    title: 'Busco o vivo en arriendo',
    text: 'Exploro el catálogo y reporto los daños del inmueble que arriendo.'
  },
  FIXER: {
    title: 'Soy técnico',
    text: 'Cotizo reparaciones, agendo visitas y cobro por trabajo terminado. Requiere verificar identidad.'
  }
};

@Component({
  selector: 'app-select-role-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>¿Cómo vas a usar Fix&amp;Rent?</h1>
          <p class="lede">Elige tu rol inicial. Las inmobiliarias y el equipo de soporte reciben su rol por invitación.</p>
        </div>
      </header>

      <form class="stack" (ngSubmit)="submit()">
        <fieldset class="stack-sm">
          <legend class="visually-hidden">Rol inicial</legend>
          @for (detail of roles; track detail.role) {
            <label class="panel role-option" [class.chosen]="chosen() === detail.role">
              <input type="radio" name="role" [value]="detail.role" [(ngModel)]="chosenValue" (change)="chosen.set(detail.role)" />
              <span class="stack-sm">
                <strong>{{ copy[detail.role].title }}</strong>
                <span class="text-muted text-sm">{{ copy[detail.role].text }}</span>
              </span>
            </label>
          }
        </fieldset>

        @if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
        }

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" [disabled]="!chosen() || store.loading()">
            {{ store.loading() ? 'Guardando…' : 'Continuar' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .role-option { display: flex; gap: var(--s-3); align-items: flex-start; cursor: pointer; }
    .role-option input { width: 20px; height: 20px; margin-top: 2px; accent-color: var(--primary); flex: none; }
    .role-option.chosen { border-color: var(--text); }
  `
})
export class SelectRolePage {
  private readonly auth = inject(AuthService);
  readonly store = inject(CurrentUserStore);
  readonly roles = INITIAL_ROLE_DETAILS;
  readonly copy = ROLE_COPY;
  readonly chosen = signal<SelectableRole | null>(null);
  readonly error = signal<string | null>(null);
  chosenValue: SelectableRole | null = null;

  submit(): void {
    const role = this.chosen();
    if (!role) return;
    this.error.set(null);
    this.auth.selectInitialRole(role).subscribe({
      error: (failure) => this.error.set(errorMessage(failure, 'No pudimos guardar tu rol. Inténtalo de nuevo.'))
    });
  }
}
