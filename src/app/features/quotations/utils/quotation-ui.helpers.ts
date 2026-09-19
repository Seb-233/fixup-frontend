import { AbstractControl, ValidationErrors } from '@angular/forms';
import { QuotationStatus } from '../../../api/generated';

export const MIN_ESTIMATED_DAYS = 1;
export const MAX_ESTIMATED_DAYS = 365;
export const MIN_QUOTATION_AMOUNT = 1;
export const MAX_SAFE_QUOTATION_AMOUNT = Number.MAX_SAFE_INTEGER; // 9007199254740991
export const MAX_MESSAGE_LENGTH = 1000;

export function quotationStatusLabel(status: QuotationStatus): string {
  switch (status) {
    case QuotationStatus.Submitted:
      return 'Enviada';
    case QuotationStatus.Accepted:
      return 'Aceptada';
    case QuotationStatus.Rejected:
      return 'Rechazada';
    default:
      return status;
  }
}

/**
 * Validates that an amount is an integer within safe range [1, 9007199254740991].
 * Reject decimals, NaN, Infinity, negative values, 0, and unsafe integers.
 */
export function safeIntegerAmountValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isSafeInteger(num) || num < MIN_QUOTATION_AMOUNT || num > MAX_SAFE_QUOTATION_AMOUNT) {
    return { safeInteger: true };
  }
  return null;
}
