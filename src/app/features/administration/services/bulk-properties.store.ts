import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import {
  BulkImportResult,
  BulkValidationError,
  BulkValidationResult,
  PropertyBulkService
} from './property-bulk.service';

@Injectable({
  providedIn: 'root'
})
export class BulkPropertiesStore {
  private readonly propertyBulkService = inject(PropertyBulkService);

  readonly step = signal<1 | 2 | 3>(1);
  readonly file = signal<File | null>(null);
  readonly validation = signal<BulkValidationResult | null>(null);
  readonly importResult = signal<BulkImportResult | null>(null);
  readonly importing = signal(false);
  readonly validating = signal(false);
  readonly error = signal<string | null>(null);

  setFile(f: File | null): void {
    this.file.set(f);
    this.validation.set(null);
    this.importResult.set(null);
    this.error.set(null);
  }

  async validate(): Promise<void> {
    const f = this.file();
    if (!f) {
      return;
    }
    this.validating.set(true);
    this.error.set(null);

    this.propertyBulkService
      .validate(f)
      .pipe(
        tap((result) => {
          this.validation.set(result);
          this.step.set(2);
        }),
        catchError((err) => {
          this.error.set(
            err?.error?.message || 'No se pudo validar el archivo. Inténtalo de nuevo.'
          );
          return of(null as unknown as BulkValidationResult);
        })
      )
      .subscribe({
        complete: () => this.validating.set(false)
      });
  }

  async importFile(): Promise<void> {
    const f = this.file();
    if (!f) {
      return;
    }
    this.importing.set(true);
    this.error.set(null);

    this.propertyBulkService
      .import(f)
      .pipe(
        tap((result) => {
        this.importResult.set(result);
        this.step.set(3);
        }),
        catchError((err) => {
          this.error.set(
            err?.error?.message || 'No se pudo importar el lote. Inténtalo de nuevo.'
          );
          return of(null as unknown as BulkImportResult);
        })
      )
      .subscribe({
        complete: () => this.importing.set(false)
      });
  }

  reset(): void {
    this.step.set(1);
    this.file.set(null);
    this.validation.set(null);
    this.importResult.set(null);
    this.importing.set(false);
    this.validating.set(false);
    this.error.set(null);
  }

  errorsForRow(rowNumber: number): BulkValidationError[] {
    return (this.validation()?.errors ?? []).filter(
      (e) => e.rowNumber === rowNumber
    );
  }
}
