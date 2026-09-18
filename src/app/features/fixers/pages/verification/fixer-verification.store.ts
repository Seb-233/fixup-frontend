import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DocumentRequest,
  FixerVerificationControllerService,
  FixerVerificationDocumentType,
  VerificationResponse
} from '../../../../api/generated';

// Estado reactivo de la verificación del técnico autenticado (FR-UC-16)
@Injectable()
export class FixerVerificationStore {
  private readonly api = inject(FixerVerificationControllerService);

  private readonly verificationState = signal<VerificationResponse | null>(null);
  private readonly loadingState = signal(false);
  private readonly submittingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly verification = this.verificationState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly submittedDocuments = computed<FixerVerificationDocumentType[]>(() =>
    Array.from(this.verificationState()?.submittedDocuments ?? [])
  );
  readonly missingDocuments = computed<FixerVerificationDocumentType[]>(() =>
    Array.from(this.verificationState()?.missingDocuments ?? [])
  );
  readonly underReview = computed(() => this.verificationState()?.underReview ?? false);
  readonly verified = computed(() => this.verificationState()?.status === 'VERIFIED');

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api.myVerification().subscribe({
      next: (verification) => {
        this.verificationState.set(verification);
        this.loadingState.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.errorState.set(this.describe(failure));
        this.loadingState.set(false);
      }
    });
  }

  submit(documents: DocumentRequest[]): void {
    this.submittingState.set(true);
    this.errorState.set(null);
    this.api.submit({ documents }).subscribe({
      next: (verification) => {
        this.verificationState.set(verification);
        this.submittingState.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.errorState.set(this.describe(failure));
        this.submittingState.set(false);
      }
    });
  }

  // Traduce los códigos del backend sin exponer detalles internos al usuario
  private describe(failure: HttpErrorResponse): string {
    switch (failure.error?.code) {
      case 'ALREADY_VERIFIED':
        return 'Tu perfil ya está verificado.';
      case 'PROFILE_SUSPENDED':
        return 'Tu perfil está suspendido y no admite nuevos documentos.';
      case 'ACCESS_DENIED':
        return 'Tu cuenta no tiene el rol de técnico activo.';
      case 'INVALID_REQUEST':
        return 'Revisa los datos enviados: falta información o el tipo no es válido.';
      default:
        return 'No se pudo completar la operación. Inténtalo de nuevo.';
    }
  }
}
