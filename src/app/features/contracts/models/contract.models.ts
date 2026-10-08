export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';

export interface ContractResponse {
  id: string;
  propertyId: string;
  propertyName?: string;
  ownerUserId: string;
  tenantUserId: string;
  tenantDisplayName?: string;
  startDate: string;
  endDate: string;
  monthlyRentAmount: number;
  depositAmount: number;
  paymentDayOfMonth: number;
  status: ContractStatus;
  renewalNoticeDays: number;
  reminder30dSent?: boolean;
  reminder7dSent?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractRequest {
  propertyId: string;
  tenantUserId: string;
  startDate: string;
  endDate: string;
  monthlyRentAmount: number;
  depositAmount: number;
  paymentDayOfMonth: number;
  renewalNoticeDays?: number;
  notes?: string;
  status?: ContractStatus;
}

export type UpdateContractRequest = Partial<CreateContractRequest>;

export interface ListContractsParams {
  status?: ContractStatus | 'ALL';
  expiringWithinDays?: number;
  propertyId?: string;
  tenantUserId?: string;
}

export interface TenantOption {
  id: string;
  displayName: string;
  email?: string;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus | 'ALL', string> = {
  ALL: 'Todos',
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  EXPIRED: 'Vencido',
  TERMINATED: 'Finalizado',
  RENEWED: 'Renovado'
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  DRAFT: 'medium',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  TERMINATED: 'danger',
  RENEWED: 'primary'
};

export function formatCurrencyCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
