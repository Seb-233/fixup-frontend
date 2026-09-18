// FR-UC-18: contratos de solicitudes de reparación, espejo del OpenAPI del backend.

// Taxonomía cerrada de oficios. El backend la valida de nuevo: aquí solo guía la interfaz.
export type Specialty =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'PAINTING'
  | 'CARPENTRY'
  | 'MASONRY'
  | 'GENERAL';

export type RepairRequestStatus = 'OPEN' | 'ASSIGNED';

// Una solicitud sale de OPEN una sola vez, cuando su dueño acepta una cotización
export interface RepairRequest {
  id: string;
  ownerUserId: string;
  specialty: Specialty;
  title: string;
  description: string;
  photoKeys: string[];
  status: RepairRequestStatus;
  assignedFixerUserId: string | null;
  createdAt: string;
}

// Cuerpo de creación. Las fotos viajan como storage keys; ningún contenido cruza la API.
export interface OpenRepairRequestPayload {
  specialty: Specialty;
  title: string;
  description: string;
  photoKeys: string[];
}

export const MAX_REQUEST_PHOTOS = 6;

export interface SpecialtyOption {
  value: Specialty;
  label: string;
}

// Etiquetas en español para la interfaz; el valor enviado al backend sigue siendo el enum
export const SPECIALTY_OPTIONS: readonly SpecialtyOption[] = [
  { value: 'PLUMBING', label: 'Plomería' },
  { value: 'ELECTRICAL', label: 'Electricidad' },
  { value: 'PAINTING', label: 'Pintura' },
  { value: 'CARPENTRY', label: 'Carpintería' },
  { value: 'MASONRY', label: 'Albañilería' },
  { value: 'GENERAL', label: 'General' },
] as const;

export function specialtyLabel(specialty: Specialty): string {
  return SPECIALTY_OPTIONS.find((option) => option.value === specialty)?.label ?? specialty;
}

export function requestStatusLabel(status: RepairRequestStatus): string {
  return status === 'OPEN' ? 'Abierta' : 'Asignada';
}
