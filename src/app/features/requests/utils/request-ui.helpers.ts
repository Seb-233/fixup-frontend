import { RepairRequestStatus, Specialty } from '../../../api/generated';

export const MAX_REQUEST_PHOTOS = 6;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedPhotoMimeType = typeof ALLOWED_PHOTO_MIME_TYPES[number];

export interface SpecialtyOption {
  value: Specialty;
  label: string;
}

export const SPECIALTY_OPTIONS: readonly SpecialtyOption[] = [
  { value: Specialty.Plumbing, label: 'Plomería' },
  { value: Specialty.Electrical, label: 'Electricidad' },
  { value: Specialty.Painting, label: 'Pintura' },
  { value: Specialty.Carpentry, label: 'Carpintería' },
  { value: Specialty.Masonry, label: 'Albañilería' },
  { value: Specialty.General, label: 'General' },
] as const;

export function specialtyLabel(specialty: Specialty): string {
  const option = SPECIALTY_OPTIONS.find((opt) => opt.value === specialty);
  return option ? option.label : specialty;
}

export function requestStatusLabel(status: RepairRequestStatus): string {
  return status === RepairRequestStatus.Open ? 'Abierta' : 'Asignada';
}
