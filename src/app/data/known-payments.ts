import { Injectable, inject } from '@angular/core';
import { CurrentUserStore } from '../core/auth/current-user.store';
import { PaymentStatus } from './models';

export interface KnownPaymentRecord {
  paymentId: string;
  requestId?: string;
  propertyTitle?: string;
  amount?: number | bigint;
  reference?: string;
  status?: PaymentStatus;
  registeredAt: string;
}

/**
 * Registro local de identificadores de pago obtenidos legítimamente durante la navegación o sesión.
 *
 * El backend definitivo no ofrece endpoints globales de listado como GET /payments/me ni
 * GET /payments/for-request/{requestId}. Este almacén retiene los paymentId conocidos en el cliente,
 * particionados por usuario, dejándole claro al usuario que no representa un historial completo
 * ni sustituye la recuperación entre dispositivos.
 */
@Injectable({ providedIn: 'root' })
export class KnownPaymentsService {
  private readonly userStore = inject(CurrentUserStore);

  private storageKey(): string {
    const userId = this.userStore.user()?.id ?? 'anonymous';
    return `fixup_known_payments_${userId}`;
  }

  list(): KnownPaymentRecord[] {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return [];
      const parsed: KnownPaymentRecord[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  get(paymentId: string): KnownPaymentRecord | undefined {
    return this.list().find(item => item.paymentId === paymentId);
  }

  findForRequest(requestId: string): KnownPaymentRecord | undefined {
    return this.list().find(item => item.requestId === requestId);
  }

  remember(
    paymentId: string,
    details?: {
      paymentId?: string;
      requestId?: string;
      propertyTitle?: string;
      amount?: number | bigint;
      reference?: string;
      status?: PaymentStatus;
      purpose?: string;
    }
  ): void {
    this.register({
      paymentId: details?.paymentId || paymentId,
      requestId: details?.requestId,
      propertyTitle: details?.propertyTitle,
      amount: details?.amount,
      reference: details?.reference,
      status: details?.status
    });
  }

  register(record: {
    paymentId: string;
    requestId?: string;
    propertyTitle?: string;
    amount?: number | bigint;
    reference?: string;
    status?: PaymentStatus;
  }): void {
    if (!record.paymentId) return;
    try {
      const items = this.list().filter(item => item.paymentId !== record.paymentId);
      const entry: KnownPaymentRecord = {
        paymentId: record.paymentId,
        requestId: record.requestId,
        propertyTitle: record.propertyTitle,
        amount: record.amount,
        reference: record.reference,
        status: record.status ?? 'PENDING',
        registeredAt: new Date().toISOString()
      };
      items.unshift(entry);
      localStorage.setItem(
        this.storageKey(),
        JSON.stringify(items.slice(0, 50), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
      );
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
  }

  updateStatus(paymentId: string, status: PaymentStatus): void {
    try {
      const items = this.list();
      const target = items.find(item => item.paymentId === paymentId);
      if (target) {
        target.status = status;
        localStorage.setItem(
          this.storageKey(),
          JSON.stringify(items, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
        );
      }
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey());
    } catch {
      // Ignorar restricciones de almacenamiento local
    }
  }

  /**
   * Limpia datos financieros temporales de sesión (intentos pendientes y claves de retiro)
   * al cerrar o cambiar de sesión, garantizando aislamiento estricto entre identidades.
   */
  clearSessionFinancialData(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('fixup_pending_attempt_') || k.startsWith('fixup_in_flight_payout_'))) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // Ignorar restricciones de almacenamiento
    }
  }
}
