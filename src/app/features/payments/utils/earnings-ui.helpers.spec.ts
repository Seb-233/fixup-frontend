import { EarningStatus, JobStatus, PayoutStatus } from '../../../api/generated';
import {
  commissionPercent,
  earningStatusLabel,
  jobStatusLabel,
  payoutStatusLabel
} from './earnings-ui.helpers';

describe('earnings-ui.helpers', () => {
  describe('earningStatusLabel', () => {
    it('debe mapear correctamente HELD, AVAILABLE y PAID_OUT', () => {
      expect(earningStatusLabel(EarningStatus.Held)).toBe('Retenido');
      expect(earningStatusLabel(EarningStatus.Available)).toBe('Disponible');
      expect(earningStatusLabel(EarningStatus.PaidOut)).toBe('Transferencia solicitada');
    });
  });

  describe('payoutStatusLabel', () => {
    it('debe mapear REQUESTED y TRANSFERRED correctamente', () => {
      expect(payoutStatusLabel(PayoutStatus.Requested)).toBe('Solicitada');
      expect(payoutStatusLabel(PayoutStatus.Transferred)).toBe('Transferido');
    });

    it('debe devolver el valor original si es desconocido', () => {
      expect(payoutStatusLabel('UNKNOWN' as unknown as PayoutStatus)).toBe('UNKNOWN');
    });
  });

  describe('jobStatusLabel', () => {
    it('debe mapear ASSIGNED y COMPLETED', () => {
      expect(jobStatusLabel(JobStatus.Assigned)).toBe('Asignado');
      expect(jobStatusLabel(JobStatus.Completed)).toBe('Cerrado');
    });
  });

  describe('commissionPercent', () => {
    it('debe convertir puntos básicos a porcentaje', () => {
      expect(commissionPercent(1000)).toBe(10);
      expect(commissionPercent(1500)).toBe(15);
      expect(commissionPercent(0)).toBe(0);
    });
  });
});
