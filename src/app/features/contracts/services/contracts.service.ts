import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { apiUrl } from '../../../api/api.routes';
import {
  ContractResponse,
  CreateContractRequest,
  UpdateContractRequest,
  ListContractsParams,
  TenantOption
} from '../models/contract.models';

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly http = inject(HttpClient);

  list(params?: ListContractsParams): Observable<ContractResponse[]> {
    if (params?.expiringWithinDays != null) {
      return this.expiring(params.expiringWithinDays);
    }
    let httpParams = new HttpParams();
    if (params?.status && params.status !== 'ALL') {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.propertyId) {
      httpParams = httpParams.set('propertyId', params.propertyId);
    }
    if (params?.tenantUserId) {
      httpParams = httpParams.set('tenantUserId', params.tenantUserId);
    }
    return this.http.get<ContractResponse[]>(apiUrl('/contracts/me'), { params: httpParams });
  }

  get(id: string): Observable<ContractResponse> {
    return this.http.get<ContractResponse>(apiUrl(`/contracts/${id}`));
  }

  create(body: CreateContractRequest): Observable<ContractResponse> {
    return this.http.post<ContractResponse>(apiUrl('/contracts'), body);
  }

  update(id: string, body: UpdateContractRequest): Observable<ContractResponse> {
    return this.http.put<ContractResponse>(apiUrl(`/contracts/${id}`), body);
  }

  renew(id: string, newEndDate: string): Observable<ContractResponse> {
    return this.http.post<ContractResponse>(apiUrl(`/contracts/${id}/renew`), {
      newEndDate
    });
  }

  terminate(id: string, reason: string): Observable<ContractResponse> {
    return this.http.post<ContractResponse>(apiUrl(`/contracts/${id}/terminate`), {
      reason
    });
  }

  expiring(days: number): Observable<ContractResponse[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<ContractResponse[]>(apiUrl('/contracts/expiring'), { params });
  }

  /**
   * PENDIENTE BACKEND: No existe en el backend actual un endpoint para listar usuarios con rol TENANT.
   * Se retorna un flujo vacío sin inventar usuarios ficticios ni simular datos inexistentes.
   */
  listTenants(): Observable<TenantOption[]> {
    return of([]);
  }

  checkOverlap(propertyId: string, startDate: string, endDate: string, excludeContractId?: string): Observable<boolean> {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return this.list({ propertyId }).pipe(
      map((contracts) =>
        contracts.some((c) => {
          if (excludeContractId && c.id === excludeContractId) return false;
          if (c.propertyId !== propertyId) return false;
          if (c.status === 'TERMINATED') return false;
          const cStart = new Date(c.startDate).getTime();
          const cEnd = new Date(c.endDate).getTime();
          return start <= cEnd && end >= cStart;
        })
      )
    );
  }
}
