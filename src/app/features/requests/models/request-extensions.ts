import type { OpenRequest, RequestDetailResponse } from '../../../api/generated';

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

export interface RequestDetailExtended extends Omit<Partial<RequestDetailResponse>, 'status'> {
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

export function adaptRequestDetail(item: RequestDetailResponse | null | undefined): RequestDetailExtended | null {
  if (!item) return null;
  const raw = item as unknown as Record<string, unknown>;
  return {
    ...item,
    urgencyLevel: (raw['urgencyLevel'] as UrgencyLevel) ?? 'MEDIUM',
    slaDeadline: (raw['slaDeadline'] as string) ?? undefined,
    status: (raw['status'] as RepairRequestStatusExt) ?? 'OPEN'
  };
}

export function toOpenRequestPayload(extended: OpenRequestExtended): OpenRequest & { urgencyLevel: UrgencyLevel } {
  return {
    propertyId: extended.propertyId,
    title: extended.title,
    description: extended.description,
    mediaIds: extended.mediaIds,
    urgencyLevel: extended.urgencyLevel
  };
}
