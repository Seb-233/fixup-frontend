/**
 * FR-UC-23 — Verificación de identidad del Fixer: constantes y utilidades de presentación.
 *
 * Se centralizan aquí (en vez de vivir sueltas dentro de cada componente) porque tanto
 * `fixer-verification.component.ts` como su store las necesitan, y ambos viven en la misma
 * feature ("fixers"). No se comparten con la pantalla de administrador
 * (`features/administration/pages/fixer-review`) a propósito: las features no deben importar
 * archivos internos de otra feature (ver docs/architecture/frontend-architecture.md, sección 5),
 * así que ese componente mantiene su propia copia mínima de las etiquetas que necesita.
 */
import { FixerVerificationDocumentType, Specialty } from '../../../api/generated';

/**
 * Versión vigente del texto de consentimiento de tratamiento de datos personales que el Fixer
 * acepta al entregar sus documentos de identidad.
 *
 * Se envía en cada envío de documentos (ver {@link FixerVerificationStore.uploadDocument}); el
 * backend la ignora si el Fixer ya había consentido antes (registro histórico e idempotente,
 * ver `SubmitFixerVerification.execute` en el backend) y solo la exige de verdad la vez en que
 * el conjunto de documentos obligatorios queda completo y aún no hay consentimiento registrado.
 */
export const CONSENT_VERSION = 'v1.0';

/**
 * Tipos MIME que el backend acepta para cualquier medio subido a `/media/uploads`, sin importar
 * el `purpose`: la validación de magic bytes en `ConfirmUpload` solo reconoce JPEG, PNG y WebP
 * (ver `docs/media-storage.md`, sección 4.2, en el repo del backend). Un documento de identidad
 * en PDF no está soportado hoy.
 */
export const ALLOWED_VERIFICATION_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedVerificationMimeType = (typeof ALLOWED_VERIFICATION_MIME_TYPES)[number];

/**
 * Límite de tamaño por archivo. Replica `fixup.media.portfolio.max-file-size` (10 MB por
 * defecto) del backend: es solo una validación temprana de UX, el backend responde 413 de
 * todas formas si se le envía un archivo más grande.
 */
export const MAX_VERIFICATION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface VerificationDocumentDescriptor {
  readonly type: FixerVerificationDocumentType;
  readonly label: string;
  readonly required: boolean;
}

/**
 * Catálogo de documentos de verificación, en el orden en que se muestran en pantalla.
 *
 * `required` refleja `VerificationPolicy.REQUIRED` en el backend: solo ID_CARD y
 * TRADE_CERTIFICATE bloquean la apertura de la revisión administrativa; BACKGROUND_CHECK e
 * INSURANCE son evidencia adicional opcional. Si esa política cambia en el backend, esta tabla
 * debe actualizarse a mano porque el frontend no la descubre dinámicamente.
 */
export const VERIFICATION_DOCUMENT_TYPES: readonly VerificationDocumentDescriptor[] = [
  { type: 'ID_CARD', label: 'Documento de identidad', required: true },
  { type: 'TRADE_CERTIFICATE', label: 'Certificado de oficio', required: true },
  { type: 'BACKGROUND_CHECK', label: 'Antecedentes', required: false },
  { type: 'INSURANCE', label: 'Póliza de seguro', required: false }
];

export function documentTypeLabel(type: FixerVerificationDocumentType): string {
  return VERIFICATION_DOCUMENT_TYPES.find((doc) => doc.type === type)?.label ?? type;
}

const SPECIALTY_LABELS: Record<Specialty, string> = {
  PLUMBING: 'Fontanería',
  ELECTRICAL: 'Electricidad',
  PAINTING: 'Pintura',
  CARPENTRY: 'Carpintería',
  MASONRY: 'Albañilería',
  GENERAL: 'Servicios Generales'
};

export function fixerSpecialtyLabel(specialty: Specialty): string {
  return SPECIALTY_LABELS[specialty] ?? specialty;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
  SUSPENDED: 'Suspendido'
};

export function verificationStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Validación temprana en el cliente antes de gastar una llamada a `/media/uploads`. No reemplaza
 * la validación del backend (Content-Type declarado + magic bytes reales en `confirmUpload`,
 * más el límite de tamaño en `requestUpload`): esta solo evita subidas que fallarán seguro y le
 * ahorra al usuario un viaje de red completo para descubrirlo.
 */
export function validateVerificationFile(file: File | null | undefined): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Debes seleccionar un archivo.' };
  }
  if (!ALLOWED_VERIFICATION_MIME_TYPES.includes(file.type as AllowedVerificationMimeType)) {
    return { valid: false, error: 'Formato no permitido. Solo se admiten imágenes JPEG, PNG o WebP.' };
  }
  if (file.size > MAX_VERIFICATION_FILE_SIZE_BYTES) {
    return { valid: false, error: 'El archivo excede el tamaño máximo permitido de 10 MB.' };
  }
  return { valid: true };
}
