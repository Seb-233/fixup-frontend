// FR-UC-18: contratos de cotizaciones, espejo del OpenAPI del backend.

export type QuotationStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

// El monto viaja en pesos colombianos enteros: no hay centavos ni coma decimal que interpretar
export interface Quotation {
  id: string;
  requestId: string;
  fixerUserId: string;
  amount: number;
  estimatedDays: number;
  message: string | null;
  status: QuotationStatus;
  createdAt: string;
}

// El autor de la cotización lo resuelve el backend desde el token, nunca este cuerpo
export interface SubmitQuotationPayload {
  requestId: string;
  amount: number;
  estimatedDays: number;
  message?: string;
}

export const MAX_ESTIMATED_DAYS = 365;

export function quotationStatusLabel(status: QuotationStatus): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Enviada';
    case 'ACCEPTED':
      return 'Aceptada';
    case 'REJECTED':
      return 'Rechazada';
  }
}
