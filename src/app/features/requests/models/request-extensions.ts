import type { RequestDetailResponse } from '../../../api/generated';

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente'
};

export const URGENCY_ORDER: UrgencyLevel[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export type RepairRequestStatusExt =
  | 'OPEN'
  | 'ASSIGNED'
  | 'SLA_WARNING'
  | 'SLA_BREACHED'
  | 'COMPLETED'
  | 'CANCELLED';

export const STATUS_LABELS_EXT: Record<RepairRequestStatusExt, string> = {
  OPEN: 'Abierta',
  ASSIGNED: 'Asignada',
  SLA_WARNING: 'SLA Warning',
  SLA_BREACHED: 'SLA Vencido',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada'
};

export interface RequestDetailExtended extends Partial<RequestDetailResponse> {
  urgencyLevel?: UrgencyLevel;
  slaDeadline?: string;
  status?: RepairRequestStatusExt;
}

export interface OpenRequestExtended {
  propertyId: string;
  title: string;
  description: string;
  mediaIds?: string[];
  urgencyLevel: UrgencyLevel;
}
