import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { FixerVerificationControllerService } from '../../../../api/generated';

// FR-UC-16: pantalla de revisión administrativa de la verificación de un técnico
@Component({
  selector: 'app-fixer-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="review">
      <h1 class="title">Revisión de técnicos</h1>
      <p class="subtitle">
        La decisión exige rol de administrador vigente en el backend. Un administrador no puede
        decidir su propia verificación.
      </p>

      <label for="fixer">Identificador interno del técnico</label>
      <input
        id="fixer"
        name="fixer"
        type="text"
        placeholder="00000000-0000-0000-0000-000000000000"
        [(ngModel)]="fixerUserId"
      />

      <label for="motivo">Motivo del rechazo</label>
      <textarea
        id="motivo"
        name="motivo"
        rows="3"
        maxlength="500"
        placeholder="Obligatorio solo para rechazar"
        [(ngModel)]="motivo"
      ></textarea>

      <div class="actions">
        <button type="button" class="btn-approve" [disabled]="!puedeDecidir()" (click)="aprobar()">
          Aprobar
        </button>
        <button type="button" class="btn-reject" [disabled]="!puedeRechazar()" (click)="rechazar()">
          Rechazar
        </button>
      </div>

      @if (procesando()) {
        <p class="loading-text">Enviando la decisión…</p>
      }
      @if (exito(); as mensaje) {
        <p class="ok" role="status">{{ mensaje }}</p>
      }
      @if (error(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem 1rem;
      }
      .review {
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 2rem;
      }
      .title {
        margin: 0;
        font-size: 1.5rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.875rem;
        margin: 0 0 1rem;
      }
      label {
        font-weight: 600;
        font-size: 0.875rem;
      }
      input,
      textarea {
        padding: 0.6rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      button {
        flex: 1;
        padding: 0.7rem 1rem;
        border: 0;
        border-radius: 8px;
        font-weight: 600;
        color: #ffffff;
        cursor: pointer;
      }
      .btn-approve {
        background: #10693c;
      }
      .btn-reject {
        background: #9b1c1c;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ok {
        color: #10693c;
      }
      .error {
        color: #9b1c1c;
      }
    `
  ]
})
export class FixerReviewComponent {
  private readonly api = inject(FixerVerificationControllerService);

  private readonly fixerState = signal('');
  private readonly motivoState = signal('');
  private readonly procesandoState = signal(false);
  private readonly exitoState = signal<string | null>(null);
  private readonly errorState = signal<string | null>(null);

  readonly procesando = this.procesandoState.asReadonly();
  readonly exito = this.exitoState.asReadonly();
  readonly error = this.errorState.asReadonly();

  get fixerUserId(): string {
    return this.fixerState();
  }

  set fixerUserId(valor: string) {
    this.fixerState.set(valor);
  }

  get motivo(): string {
    return this.motivoState();
  }

  set motivo(valor: string) {
    this.motivoState.set(valor);
  }

  puedeDecidir(): boolean {
    return this.fixerState().trim().length > 0 && !this.procesandoState();
  }

  puedeRechazar(): boolean {
    return this.puedeDecidir() && this.motivoState().trim().length > 0;
  }

  aprobar(): void {
    if (!this.puedeDecidir()) {
      return;
    }
    this.enviar(this.api.approve(this.fixerState().trim()), 'El técnico quedó verificado.');
  }

  rechazar(): void {
    if (!this.puedeRechazar()) {
      return;
    }
    this.enviar(
      this.api.reject(this.fixerState().trim(), { reason: this.motivoState().trim() }),
      'La verificación quedó rechazada y el técnico puede volver a enviarla.'
    );
  }

  private enviar(peticion: { subscribe: (observer: Record<string, unknown>) => unknown }, ok: string): void {
    this.procesandoState.set(true);
    this.exitoState.set(null);
    this.errorState.set(null);
    peticion.subscribe({
      next: () => {
        this.procesandoState.set(false);
        this.exitoState.set(ok);
        this.motivoState.set('');
      },
      error: (failure: HttpErrorResponse) => {
        this.procesandoState.set(false);
        this.errorState.set(this.describe(failure));
      }
    });
  }

  // Traduce los códigos de conflicto del backend a un mensaje accionable
  private describe(failure: HttpErrorResponse): string {
    switch (failure.error?.code) {
      case 'NOT_UNDER_REVIEW':
        return 'Ese técnico no tiene una entrega esperando decisión.';
      case 'SELF_REVIEW':
        return 'Un administrador no puede decidir su propia verificación.';
      case 'PROFILE_NOT_FOUND':
        return 'No existe un perfil de técnico con ese identificador.';
      case 'ALREADY_VERIFIED':
        return 'Ese perfil ya está verificado.';
      case 'PROFILE_SUSPENDED':
        return 'Ese perfil está suspendido.';
      case 'ACCESS_DENIED':
        return 'Tu cuenta no tiene privilegios de administrador vigentes.';
      case 'INVALID_REQUEST':
        return 'Revisa el identificador y el motivo enviados.';
      default:
        return 'No se pudo registrar la decisión. Inténtalo de nuevo.';
    }
  }
}
