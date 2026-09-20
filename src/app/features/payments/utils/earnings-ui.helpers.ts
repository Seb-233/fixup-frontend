import { EarningStatus, JobStatus } from '../../../api/generated';

export function earningStatusLabel(status: EarningStatus): string {
  switch (status) {
    case EarningStatus.Held:
      return 'Retenido';
    case EarningStatus.Available:
      return 'Disponible';
    case EarningStatus.PaidOut:
      return 'Transferido';
    default:
      return status;
  }
}

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case JobStatus.Assigned:
      return 'Asignado';
    case JobStatus.Completed:
      return 'Cerrado';
    default:
      return status;
  }
}

/**
 * La comisión se muestra como porcentaje a partir de los puntos básicos que guardó el backend,
 * no como una constante escrita aquí: la tarifa se congela en cada ingreso al crearlo, así que
 * un ingreso viejo debe seguir mostrando la tarifa con la que se liquidó.
 */
export function commissionPercent(basisPoints: number): number {
  return basisPoints / 100;
}
