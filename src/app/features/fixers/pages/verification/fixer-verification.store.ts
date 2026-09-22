import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfirmResponseDto,
  FixerVerificationControllerService,
  FixerVerificationDocumentType,
  MediaPurpose,
  MediaUploadsControllerService,
  Specialty,
  UploadTicketDto,
  VerificationResponse
} from '../../../../api/generated';

/**
 * FR-UC-23 — Verificación de identidad del Fixer (lado del técnico).
 *
 * Guarda y expone el estado reactivo de la verificación del Fixer autenticado: qué documentos ha
 * entregado, cuáles faltan, sus especialidades, y el progreso de la subida de un documento en
 * curso. Es un `Injectable()` con proveedor a nivel de componente (no `providedIn: 'root'`)
 * porque su estado solo tiene sentido mientras la pantalla de verificación está montada.
 *
 * Se diseñó como store separado del componente, en vez de lógica inline, por dos razones:
 *  - Los componentes no deben consumir `HttpClient` ni las APIs generadas directamente
 *    (docs/architecture/frontend-architecture.md, sección "api/"): toda la orquestación HTTP
 *    vive aquí.
 *  - Subir un documento no es una sola llamada: son varias llamadas HTTP encadenadas (ver
 *    {@link uploadDocument}). Mantener esa orquestación en un único lugar evita que el
 *    componente termine con lógica de red repartida en distintos manejadores de eventos.
 *
 * Contrato de seguridad relevante (por qué el archivo nunca pasa por el backend de FixUp): el
 * Fixer sube el binario directo al almacenamiento de objetos (S3/MinIO) usando una URL firmada
 * de un solo uso que expira a los 15 minutos; el backend jamás recibe ni maneja el contenido del
 * documento de identidad, solo el resultado ya confirmado (un `mediaId`). Esto reduce la
 * superficie de ataque del backend y evita que datos sensibles de identidad transiten por un
 * salto de red adicional bajo control de FixUp.
 */
@Injectable()
export class FixerVerificationStore {
  private readonly api = inject(FixerVerificationControllerService);
  private readonly mediaUploadsApi = inject(MediaUploadsControllerService);
  private readonly httpClient = inject(HttpClient);

  private readonly verificationState = signal<VerificationResponse | null>(null);
  private readonly loadingState = signal(false);
  private readonly submittingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  // Documento que se está subiendo en este momento (si lo hay) y en qué paso del flujo va.
  // Solo se permite una subida en curso a la vez a propósito: subir de a un documento evita
  // condiciones de carrera al construir el conjunto de documentos entregados en el backend
  // (dos "submit1" concurrentes podrían pisarse) y simplifica la barra de progreso en la UI,
  // que solo necesita mostrar un paso a la vez en vez de una lista de progresos independientes.
  private readonly uploadingTypeState = signal<FixerVerificationDocumentType | null>(null);
  private readonly uploadStepState = signal<string | null>(null);
  private readonly uploadErrorState = signal<string | null>(null);

  readonly verification = this.verificationState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly submitting = this.submittingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly uploadingType = this.uploadingTypeState.asReadonly();
  readonly uploadStep = this.uploadStepState.asReadonly();
  readonly uploadError = this.uploadErrorState.asReadonly();

  readonly submittedDocuments = computed<FixerVerificationDocumentType[]>(() =>
    Array.from(this.verificationState()?.submittedDocuments ?? [])
  );
  readonly missingDocuments = computed<FixerVerificationDocumentType[]>(() =>
    Array.from(this.verificationState()?.missingDocuments ?? [])
  );
  readonly specialties = computed<Specialty[]>(() =>
    Array.from(this.verificationState()?.specialties ?? [])
  );
  readonly underReview = computed(() => this.verificationState()?.underReview ?? false);
  readonly verified = computed(() => this.verificationState()?.status === 'VERIFIED');

  /** FR-UC-23: carga el estado propio de verificación (GET /fixers/me/verification). */
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

  /**
   * FR-UC-23: sube un documento de identidad de punta a punta y lo archiva.
   *
   * Encadena las llamadas HTTP que exige el contrato vigente del backend (ver
   * `docs/media-storage.md` y `FixerVerificationController` en el repo del backend):
   *  1. `POST /media/uploads` — pide un ticket de subida firmado con
   *     `purpose: FIXER_VERIFICATION`. El backend crea un `MediaAsset` en estado `PENDING` y
   *     devuelve una URL de subida (PUT) que expira en 15 minutos.
   *  2. `PUT <uploadUrl del ticket>` — sube el binario directo al almacenamiento. Este paso NO
   *     pasa por ninguna ruta de FixUp: va directo a S3/MinIO.
   *  3. `POST /media/uploads/{mediaId}/confirm` — el backend compara el objeto ya subido contra
   *     lo declarado (tamaño, Content-Type, magic bytes) y recién ahí el `mediaId` pasa a
   *     estado `READY`. Un archivo cuyo contenido no coincide con lo declarado queda `INVALID`
   *     y este paso falla con 409/415.
   *  4. `POST /fixers/me/verification/documents` — archiva el `{type, mediaId}` ya confirmado.
   *     Si con este documento se completa el conjunto obligatorio (`VerificationPolicy.REQUIRED`)
   *     y ya hay consentimiento registrado, el backend abre la revisión administrativa por sí
   *     solo; no hay un paso explícito de "enviar a revisión" en el frontend.
   *
   * Cada paso solo se intenta si el anterior tuvo éxito: un `mediaId` que nunca llegó a `READY`
   * no debe archivarse, porque el backend lo rechazaría igual pero con un error menos claro
   * para el usuario que fallar aquí con un mensaje específico del paso que realmente falló.
   *
   * @param type tipo de documento que se está entregando.
   * @param file archivo elegido por el usuario en el `<input type="file">`.
   * @param consentVersion versión del consentimiento de tratamiento de datos a registrar en este
   *   envío, o `undefined` si el usuario no marcó la casilla de consentimiento. El backend la
   *   ignora si el Fixer ya había consentido antes; solo falla (409 `CONSENT_REQUIRED`) si hace
   *   falta un consentimiento nuevo y no se envía ninguno.
   */
  uploadDocument(
    type: FixerVerificationDocumentType,
    file: File,
    consentVersion: string | undefined
  ): void {
    if (this.uploadingTypeState() !== null) {
      // Ya hay una subida en curso: ignorar un doble click o una segunda selección de archivo.
      return;
    }

    this.uploadingTypeState.set(type);
    this.uploadStepState.set('Solicitando autorización de subida…');
    this.uploadErrorState.set(null);
    this.errorState.set(null);

    this.mediaUploadsApi
      .requestUpload({
        purpose: MediaPurpose.FixerVerification,
        contentType: file.type,
        sizeBytes: file.size
      })
      .subscribe({
        next: (ticket) => this.uploadBinaryAndContinue(type, file, ticket, consentVersion),
        error: (failure: HttpErrorResponse) => this.failUpload(this.describeUploadFailure(failure))
      });
  }

  private uploadBinaryAndContinue(
    type: FixerVerificationDocumentType,
    file: File,
    ticket: UploadTicketDto,
    consentVersion: string | undefined
  ): void {
    this.uploadStepState.set('Subiendo archivo al almacenamiento…');
    this.putToSignedUrl(ticket, file).subscribe({
      next: () => this.confirmAndContinue(type, ticket.mediaId, consentVersion),
      error: () => this.failUpload('No pudimos subir el archivo al almacenamiento. Intenta de nuevo.')
    });
  }

  private confirmAndContinue(
    type: FixerVerificationDocumentType,
    mediaId: string,
    consentVersion: string | undefined
  ): void {
    this.uploadStepState.set('Confirmando la subida…');
    this.mediaUploadsApi.confirmUpload(mediaId).subscribe({
      next: (confirmed: ConfirmResponseDto) => this.fileDocument(type, confirmed.mediaId, consentVersion),
      error: (failure: HttpErrorResponse) => this.failUpload(this.describeUploadFailure(failure))
    });
  }

  private fileDocument(
    type: FixerVerificationDocumentType,
    mediaId: string,
    consentVersion: string | undefined
  ): void {
    this.uploadStepState.set('Registrando el documento…');
    this.submittingState.set(true);
    this.api.submit1({ documents: [{ type, mediaId }], consentVersion }).subscribe({
      next: (verification) => {
        this.verificationState.set(verification);
        this.submittingState.set(false);
        this.uploadingTypeState.set(null);
        this.uploadStepState.set(null);
      },
      error: (failure: HttpErrorResponse) => {
        this.submittingState.set(false);
        this.failUpload(this.describe(failure));
      }
    });
  }

  /**
   * Sube el binario directo al almacenamiento de objetos usando la URL firmada del ticket.
   *
   * No pasa por ninguna API generada de FixUp a propósito: el backend nunca ve este cuerpo, así
   * que se usa `HttpClient` de bajo nivel en vez de un servicio de la API tipada. La feature
   * "requests" resuelve el mismo problema para las fotos de solicitudes en
   * `RequestMediaService.uploadBinary`; no se reutiliza ese servicio aquí porque las features no
   * deben importar archivos internos de otra feature (la duplicación de estas ~10 líneas es el
   * costo aceptado de mantener el aislamiento).
   */
  private putToSignedUrl(ticket: UploadTicketDto, file: File): Observable<unknown> {
    let headers = new HttpHeaders();
    Object.entries(ticket.headers ?? {}).forEach(([key, value]) => {
      headers = headers.set(key, value);
    });
    if (!headers.has('Content-Type')) {
      headers = headers.set('Content-Type', file.type);
    }

    return this.httpClient.request(ticket.method || 'PUT', ticket.uploadUrl, {
      body: file,
      headers,
      observe: 'response',
      responseType: 'text'
    });
  }

  private failUpload(message: string): void {
    this.uploadingTypeState.set(null);
    this.uploadStepState.set(null);
    this.uploadErrorState.set(message);
  }

  updateSpecialties(specialties: Specialty[]): void {
    if (!specialties || specialties.length === 0) {
      this.errorState.set('Debes seleccionar al menos una especialidad.');
      return;
    }
    this.submittingState.set(true);
    this.errorState.set(null);
    this.api.updateSpecialties({ specialties }).subscribe({
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

  /** Traduce errores específicos del tramo de subida (ticket de subida / confirmación). */
  private describeUploadFailure(failure: HttpErrorResponse): string {
    if (failure.status === 413) {
      return 'El archivo excede el tamaño máximo permitido.';
    }
    if (failure.status === 415) {
      return 'Formato de archivo no permitido. Solo se admiten imágenes JPEG, PNG o WebP.';
    }
    return this.describe(failure);
  }

  // Traduce códigos de error HTTP y del backend sin exponer detalles internos al usuario
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
      case 'CONSENT_REQUIRED':
        return 'Debes aceptar el tratamiento de tus datos personales para completar la verificación.';
      case 'INVALID_CONSENT_VERSION':
        return 'La versión de consentimiento enviada no es válida.';
    }
    if (failure.status === 401) {
      return 'Sesión expirada o no autenticada. Inicia sesión nuevamente.';
    }
    if (failure.status === 403) {
      return 'Tu cuenta no tiene el rol de técnico activo.';
    }
    if (failure.status === 404) {
      return 'Perfil de técnico no encontrado.';
    }
    if (failure.status === 409) {
      return failure.error?.message || 'Conflicto de estado en la verificación.';
    }
    if (failure.status === 400) {
      return failure.error?.message || 'Revisa los datos enviados: información incompleta o formato inválido.';
    }
    return failure.error?.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
