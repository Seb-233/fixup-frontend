import {
  RemodelingProgressStatus,
  RepairRequestStatus,
  JobStatus,
  Specialty,
  UrgencyLevel
} from '../../../api/generated';

export function remodelingProgressLabel(status: RemodelingProgressStatus | string): string {
  switch (status) {
    case RemodelingProgressStatus.Open:
      return 'Abierta';
    case RemodelingProgressStatus.PartiallyAssigned:
      return 'Parcialmente asignada';
    case RemodelingProgressStatus.FullyAssigned:
      return 'Totalmente asignada';
    case RemodelingProgressStatus.PartiallyCompleted:
      return 'Parcialmente completada';
    case RemodelingProgressStatus.Completed:
      return 'Completada';
    default:
      return status;
  }
}

export function specialtyLabel(specialty: Specialty | string): string {
  switch (specialty) {
    case Specialty.Plumbing:
      return 'Plomería';
    case Specialty.Electrical:
      return 'Electricidad';
    case Specialty.Painting:
      return 'Pintura';
    case Specialty.Carpentry:
      return 'Carpintería';
    case Specialty.Masonry:
      return 'Albañilería';
    case Specialty.General:
      return 'General';
    default:
      return specialty;
  }
}

export function requestStatusLabel(status: RepairRequestStatus | string): string {
  switch (status) {
    case RepairRequestStatus.Open:
      return 'Abierta';
    case RepairRequestStatus.Assigned:
      return 'Asignada';
    case RepairRequestStatus.SlaWarning:
      return 'Alerta SLA';
    case RepairRequestStatus.SlaBreached:
      return 'SLA vencido';
    case RepairRequestStatus.Completed:
      return 'Completada';
    case RepairRequestStatus.Cancelled:
      return 'Cancelada';
    default:
      return status;
  }
}

export function jobStatusLabel(status?: JobStatus | string | null): string {
  if (!status) return 'Sin trabajo activo';
  switch (status) {
    case JobStatus.Assigned:
      return 'Asignado';
    case JobStatus.InProgress:
      return 'En progreso';
    case JobStatus.SlaAtRisk:
      return 'SLA en riesgo';
    case JobStatus.Completed:
      return 'Completado';
    default:
      return status;
  }
}

export function urgencyLevelLabel(level?: UrgencyLevel | string): string {
  switch (level) {
    case UrgencyLevel.Low:
      return 'Baja';
    case UrgencyLevel.Medium:
      return 'Media';
    case UrgencyLevel.High:
      return 'Alta';
    case UrgencyLevel.Urgent:
      return 'Urgente';
    default:
      return level ?? 'Media';
  }
}
