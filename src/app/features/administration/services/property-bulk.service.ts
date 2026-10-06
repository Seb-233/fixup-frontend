import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BulkValidationError {
  rowNumber: number;
  field?: string;
  code: string;
  message: string;
}

export interface BulkValidationResult {
  total: number;
  validCount: number;
  errors: BulkValidationError[];
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  importedIds: string[];
  errors: BulkValidationError[];
}

@Injectable({
  providedIn: 'root'
})
export class PropertyBulkService {
  private readonly http = inject(HttpClient);
  private readonly env = environment;

  validate(file: File): Observable<BulkValidationResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<BulkValidationResult>(
      `${this.env.apiOrigin}/properties/bulk/validate`,
      formData
    );
  }

  import(file: File): Observable<BulkImportResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<BulkImportResult>(
      `${this.env.apiOrigin}/properties/bulk/import`,
      formData
    );
  }

  downloadTemplate(): Observable<Blob> {
    const csvContent =
      'name,address,city,areaM2\n"Casa Ejemplo","Calle 123 #45-67","Bogotá",80\n';
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    return of(blob);
  }
}
